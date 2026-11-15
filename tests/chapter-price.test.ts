import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: any, one: any, initSchema: any;
let purchases: any;

let authorId = 0;
let buyerId = 0;
let workId = 0;
let chapterId = 0;
let secondChapterId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-chapter-price-'));
  const db = await import('../lib/db');
  query = db.query; one = db.one; initSchema = db.initSchema;
  await initSchema();
  purchases = await import('../lib/purchases');

  const mkUser = async (email: string) =>
    (await one<{ id: number }>(
      'INSERT INTO users (email, display_name, role) VALUES ($1,$2,$3) RETURNING id',
      [email, email.split('@')[0], 'reader']
    ))!.id;

  authorId = await mkUser('comic-author@test.rs');
  buyerId = await mkUser('comic-buyer@test.rs');

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, type, original_language, status, title, published_at)
     VALUES ('comic-test', $1, 'comic', 'sr', 'published', 'Test strip', CURRENT_TIMESTAMP) RETURNING id`,
    [authorId]
  ))!.id;
  // Книга целиком — 1 200 RSD (потолок для глав: 1 200 монет).
  await query('INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES ($1, 120000, $2, 1)', [workId, 'RSD']);

  chapterId = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 1, 'Glava 1', '', 'paid', 300, 'published') RETURNING id`,
    [workId]
  ))!.id;
  secondChapterId = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 2, 'Glava 2', '', 'paid', 300, 'published') RETURNING id`,
    [workId]
  ))!.id;
});

describe('цена главы в монетах (1 монета = 1 RSD)', () => {
  it('setChapterCoins хранит цену в монетах и дублирует её в пары RSD', async () => {
    const res = await purchases.setChapterCoins(chapterId, 15);
    expect(res.ok).toBe(true);
    expect(res.coins).toBe(15);

    const price = await purchases.chapterPrice(chapterId);
    expect(price).toEqual({ coins: 15, amount_cents: 1500, currency: 'RSD' });

    const row = await one<{ coins: number; currency: string }>(
      'SELECT coins, currency FROM chapter_prices WHERE chapter_id = $1', [chapterId]
    );
    expect(Number(row?.coins)).toBe(15);
    expect(row?.currency).toBe('RSD');
  });

  it('создаёт идемпотентную покупку главы на актуальную цену', async () => {
    const first = await purchases.startPurchase(buyerId, { chapterId }, 'manual');
    expect(first.ok).toBe(true);
    expect(first.already).toBe(false);
    expect(first.purchase.chapter_id).toBe(chapterId);
    expect(first.purchase.amount_cents).toBe(1500);
    expect(first.purchase.currency).toBe('RSD');
    expect(first.target.coins).toBe(15);

    const second = await purchases.startPurchase(buyerId, { chapterId }, 'manual');
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.purchase.id).toBe(first.purchase.id);
  });

  it('после оплаты глава открыта, повторная оплата не задваивает доступ', async () => {
    const started = await purchases.startPurchase(buyerId, { chapterId }, 'manual');
    const paid = await purchases.markPurchasePaid(started.purchase.id, 'ext-chapter-1');
    expect(paid.ok).toBe(true);
    expect(paid.already).toBe(false);

    expect(await purchases.hasChapterPurchase(buyerId, chapterId)).toBe(true);

    const again = await purchases.markPurchasePaid(started.purchase.id, 'ext-chapter-1');
    expect(again.ok).toBe(true);
    expect(again.already).toBe(true);

    const rows = await query('SELECT COUNT(*) AS n FROM purchases WHERE user_id = $1 AND chapter_id = $2', [
      buyerId, chapterId,
    ]);
    expect(Number(rows[0].n)).toBe(1);
  });

  it('неактивная цена главы откатывается к chapters.price_cents', async () => {
    await query('UPDATE chapter_prices SET active = 0 WHERE chapter_id = $1', [chapterId]);
    const price = await purchases.chapterPrice(chapterId);
    expect(price?.coins).toBe(15); // setChapterCoins синхронизировал chapters.price_cents
    await query('UPDATE chapter_prices SET active = 1 WHERE chapter_id = $1', [chapterId]);
  });
});

describe('потолок цен глав (P3)', () => {
  it('сумма цен глав не превышает цену книги: цена урезается автоматически', async () => {
    // Первая глава 15 монет, вторая просит 2000 → доступно 1200-15 = 1185.
    const res = await purchases.setChapterCoins(secondChapterId, 2000);
    expect(res.ok).toBe(true);
    expect(res.coins).toBe(1185);
    expect(res.capped).toBe(true);

    const summary = await purchases.chapterPriceSummary(workId);
    expect(summary.book_coins).toBe(1200);
    expect(summary.chapters_coins).toBe(1200);
    expect(summary.cap_exceeded).toBe(false);
  });

  it('при снижении цены книги лишние монеты снимаются с последних глав', async () => {
    await query('UPDATE book_prices SET amount_cents = 50000 WHERE work_id = $1', [workId]); // 500 RSD
    const { trimmed, summary } = await purchases.enforceChapterCap(workId);
    expect(trimmed).toBeGreaterThan(0);
    expect(summary.book_coins).toBe(500);
    expect(summary.chapters_coins).toBeLessThanOrEqual(500);
    expect(summary.cap_exceeded).toBe(false);
  });
});
