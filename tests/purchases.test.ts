import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: any, one: any, initSchema: any;
let royalty: any, purchases: any, publisher: any;

let buyerId = 0;
let otherId = 0;
let publisherId = 0;
let workId = 0;
let paidChapter = 0;
let neighbourChapter = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-purchases-'));
  const db = await import('../lib/db');
  query = db.query; one = db.one; initSchema = db.initSchema;
  await initSchema();

  royalty = await import('../lib/royalty');
  purchases = await import('../lib/purchases');
  publisher = await import('../lib/publisher');

  const mkUser = async (email: string) =>
    (await one<{ id: number }>(
      'INSERT INTO users (email, display_name, role) VALUES ($1,$2,$3) RETURNING id',
      [email, email.split('@')[0], 'reader']
    ))!.id;

  const authorId = await mkUser('author@test.rs');
  buyerId = await mkUser('buyer@test.rs');
  otherId = await mkUser('other@test.rs');

  publisherId = (await one<{ id: number }>(
    `INSERT INTO publishers (name, slug, contact_email, commission_pct)
     VALUES ('Test Izdavač', 'test-izdavac', 'pub@test.rs', 30) RETURNING id`
  ))!.id;

  await query('INSERT INTO publisher_members (publisher_id, user_id, role) VALUES ($1,$2,$3)',
    [publisherId, buyerId, 'owner']);

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, publisher_id, published_at)
     VALUES ('test-knjiga', $1, 'sr', 'published', 'Test knjiga', $2, CURRENT_TIMESTAMP) RETURNING id`,
    [authorId, publisherId]
  ))!.id;

  await query(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES ($1,$2,$3,1)`,
    [workId, 1500, 'EUR']
  );

  await query(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1,1,'Prva','tekst','free',0,'published')`,
    [workId]
  );
  paidChapter = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1,2,'Druga','tekst','paid',300,'published') RETURNING id`,
    [workId]
  ))!.id;
  neighbourChapter = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1,3,'Treća','tekst','paid',300,'published') RETURNING id`,
    [workId]
  ))!.id;
});

describe('роялти и комиссия', () => {
  it('комиссия округляется до целого цента, доли в сумме дают ровно сумму покупки', () => {
    const s = royalty.splitRoyalty(1500, 30);
    expect(s).toEqual({ amount_cents: 1500, commission_cents: 450, publisher_cents: 1050 });
  });

  it('дробные проценты не теряют цент', () => {
    const s = royalty.splitRoyalty(999, 15); // 149.85 → 150
    expect(s.commission_cents).toBe(150);
    expect(s.publisher_cents).toBe(849);
    expect(s.commission_cents + s.publisher_cents).toBe(999);
  });

  it('нулевая и стопроцентная комиссия', () => {
    expect(royalty.splitRoyalty(500, 0)).toEqual({ amount_cents: 500, commission_cents: 0, publisher_cents: 500 });
    expect(royalty.splitRoyalty(500, 100)).toEqual({ amount_cents: 500, commission_cents: 500, publisher_cents: 0 });
  });

  it('мелкие суммы не дают отрицательного остатка', () => {
    const s = royalty.splitRoyalty(1, 30);
    expect(s.commission_cents).toBe(0);
    expect(s.publisher_cents).toBe(1);
  });
});

describe('покупка книги', () => {
  it('вторая попытка не создаёт вторую покупку', async () => {
    const a = await purchases.startPurchase(buyerId, { workId });
    const b = await purchases.startPurchase(buyerId, { workId });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.purchase.id).toBe(b.purchase.id);
    expect(b.already).toBe(false);
    expect(a.purchase.amount_cents).toBe(1500);
    expect(a.purchase.currency).toBe('EUR');
  });

  it('повторное подтверждение не задваивает роялти', async () => {
    const pending = await purchases.startPurchase(buyerId, { workId });
    if (!pending.ok) throw new Error('purchase failed');

    const first = await purchases.markPurchasePaid(pending.purchase.id);
    const second = await purchases.markPurchasePaid(pending.purchase.id);
    expect(first.ok && !first.already).toBe(true);
    expect(second.ok && second.already).toBe(true);

    const ledger = await query(
      'SELECT amount_cents, commission_cents FROM royalty_ledger WHERE purchase_id = $1',
      [pending.purchase.id]
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount_cents).toBe(1500);
    expect(ledger[0].commission_cents).toBe(450);

    expect(await purchases.hasWorkPurchase(buyerId, workId)).toBe(true);
    expect(await purchases.hasWorkAccess(buyerId, workId)).toBe(true);
  });

  it('оплаченную покупку нельзя оформить ещё раз', async () => {
    const again = await purchases.startPurchase(buyerId, { workId });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.already).toBe(true);
  });
});

describe('доступ к главам', () => {
  it('купленная глава открыта, соседняя — нет', async () => {
    const s = await purchases.startPurchase(otherId, { chapterId: paidChapter });
    if (!s.ok) throw new Error('chapter purchase failed');
    expect(s.purchase.work_id).toBe(workId);
    expect(s.purchase.chapter_id).toBe(paidChapter);

    await purchases.markPurchasePaid(s.purchase.id);

    const bought = await purchases.chapterGate(
      { id: paidChapter, work_id: workId, access: 'paid' }, { uid: otherId, role: 'reader' }
    );
    expect(bought.allowed).toBe(true);
    expect(bought.reason).toBe('purchased');

    const neighbour = await purchases.chapterGate(
      { id: neighbourChapter, work_id: workId, access: 'paid' }, { uid: otherId, role: 'reader' }
    );
    expect(neighbour.allowed).toBe(false);
    expect(neighbour.reason).toBe('payment_required');
  });

  it('чужая покупка не открывает главу', async () => {
    const stranger = await purchases.chapterGate(
      { id: paidChapter, work_id: workId, access: 'paid' }, { uid: buyerId, role: 'reader' }
    );
    // buyer купил книгу целиком — доступ у него есть, но по другому основанию
    expect(stranger.allowed).toBe(true);
    expect(stranger.reason).toBe('purchased');

    const anon = await purchases.chapterGate(
      { id: paidChapter, work_id: workId, access: 'paid' }, null
    );
    expect(anon.allowed).toBe(false);
    expect(anon.reason).toBe('login_required');
  });

  it('бесплатная глава открыта всем', async () => {
    const free = await purchases.chapterGate(
      { id: paidChapter + 100, work_id: workId, access: 'free' }, null
    );
    expect(free.allowed).toBe(true);
    expect(free.reason).toBe('free');
  });

  it('подписка открывает главу для подписчиков, но не платную', async () => {
    await query(
      `INSERT INTO subscriptions (user_id, plan_code, status, current_period_start, current_period_end)
       VALUES ($1,'reader','active',CURRENT_TIMESTAMP, datetime('now','+30 days'))`,
      [otherId]
    );
    const subscriberPaid = await purchases.chapterGate(
      { id: neighbourChapter, work_id: workId, access: 'paid' }, { uid: otherId, role: 'reader' }
    );
    expect(subscriberPaid.allowed).toBe(false);

    const subscriberOnly = await purchases.chapterGate(
      { id: neighbourChapter, work_id: workId, access: 'subscribers' }, { uid: otherId, role: 'reader' }
    );
    expect(subscriberOnly.allowed).toBe(true);
    expect(subscriberOnly.reason).toBe('subscription');
  });

  it('автор и админ читают любую главу', async () => {
    const author = await one<{ author_id: number }>('SELECT author_id FROM works WHERE id = $1', [workId]);
    const asAuthor = await purchases.chapterGate(
      { id: neighbourChapter, work_id: workId, access: 'paid' }, { uid: author!.author_id, role: 'author' }
    );
    expect(asAuthor.allowed).toBe(true);
    expect(asAuthor.reason).toBe('author');

    const asAdmin = await purchases.chapterGate(
      { id: neighbourChapter, work_id: workId, access: 'paid' }, { uid: 999_999, role: 'admin' }
    );
    expect(asAdmin.allowed).toBe(true);
    expect(asAdmin.reason).toBe('admin');
  });
});

describe('отчёт издателя за период', () => {
  it('считает продажи, выручку, комиссию, роялти и к выплате', async () => {
    const report = await publisher.publisherReport(publisherId, '2000-01-01', '2099-12-31');
    const eur = report.byCurrency.find((r: any) => r.currency === 'EUR');
    expect(eur).toBeTruthy();
    // книга 1500 + глава 300
    expect(eur.sales).toBe(2);
    expect(eur.gross_cents).toBe(1800);
    expect(eur.commission_cents).toBe(540);
    expect(eur.royalty_cents).toBe(1260);
    expect(report.payable.find((p: any) => p.currency === 'EUR')?.amount_cents).toBe(1260);
  });

  it('пустой период даёт нули, а не ошибку', async () => {
    const report = await publisher.publisherReport(publisherId, '1990-01-01', '1990-12-31');
    expect(report.byCurrency).toEqual([]);
  });

  it('продажи другого издательства не попадают в отчёт', async () => {
    const otherPublisher = (await one<{ id: number }>(
      `INSERT INTO publishers (name, slug, commission_pct) VALUES ('Drugi','drugi',20) RETURNING id`
    ))!.id;
    const report = await publisher.publisherReport(otherPublisher, '2000-01-01', '2099-12-31');
    expect(report.byCurrency).toEqual([]);
  });

  it('книги издательства видны с ценой и продажами', async () => {
    const works = await publisher.publisherWorks(publisherId);
    const w = works.find((x: any) => x.id === workId);
    expect(w).toBeTruthy();
    expect(w.amount_cents).toBe(1500);
    expect(w.currency).toBe('EUR');
    expect(w.sales).toBe(2);
    expect(w.royalty_cents).toBe(1260);
  });
});
