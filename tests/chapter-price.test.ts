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
  await query('INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES ($1, 1200, $2, 1)', [workId, 'EUR']);

  chapterId = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 1, 'Glava 1', '', 'paid', 300, 'published') RETURNING id`,
    [workId]
  ))!.id;
});

describe('покупка главы комикса', () => {
  it('цена берётся из chapter_prices и переопределяет chapters.price_cents', async () => {
    const res = await purchases.setChapterPrice(chapterId, 250, 'EUR');
    expect(res.ok).toBe(true);

    const price = await purchases.chapterPrice(chapterId);
    expect(price).toEqual({ amount_cents: 250, currency: 'EUR' });
  });

  it('создаёт идемпотентную покупку главы на актуальную цену', async () => {
    const first = await purchases.startPurchase(buyerId, { chapterId }, 'manual');
    expect(first.ok).toBe(true);
    expect(first.already).toBe(false);
    expect(first.purchase.chapter_id).toBe(chapterId);
    expect(first.purchase.amount_cents).toBe(250);

    const second = await purchases.startPurchase(buyerId, { chapterId }, 'manual');
    expect(second.ok).toBe(true);
    expect(second.purchase.id).toBe(first.purchase.id);
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

    const rows = await query("SELECT COUNT(*) AS n FROM purchases WHERE user_id = $1 AND chapter_id = $2", [
      buyerId,
      chapterId,
    ]);
    expect(Number(rows[0].n)).toBe(1);
  });

  it('неактивная цена главы откатывается к chapters.price_cents', async () => {
    await query('UPDATE chapter_prices SET active = 0 WHERE chapter_id = $1', [chapterId]);
    const price = await purchases.chapterPrice(chapterId);
    expect(price?.amount_cents).toBe(250); // setChapterPrice синхронизировал chapters.price_cents
  });
});
