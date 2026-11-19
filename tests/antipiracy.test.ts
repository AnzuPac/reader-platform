import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Приёмка §7.11 антипиратской спеки: проверяем то, что действительно
 * реализовано в коде, а не то, что хотелось бы обещать.
 */

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let one: One;
let chapterGate: typeof import('../lib/purchases').chapterGate;
let encodeId: typeof import('../lib/watermark').encodeId;
let decodeId: typeof import('../lib/watermark').decodeId;
let rateLimit: typeof import('../lib/ratelimit').rateLimit;
let exportPolicy: typeof import('../lib/export').exportPolicy;
let protectionMode: typeof import('../lib/rights').protectionMode;
let licenseAllows: typeof import('../lib/publisher').licenseAllows;
let listReviews: typeof import('../lib/reviews').listReviews;

let authorId = 0;
let readerId = 0;
let freeChapter = 0;
let paidChapter = 0;
let subsChapter = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-antipiracy-'));
  const db = await import('../lib/db');
  one = db.one as One;
  await db.initSchema();

  ({ chapterGate } = await import('../lib/purchases'));
  ({ encodeId, decodeId } = await import('../lib/watermark'));
  ({ rateLimit } = await import('../lib/ratelimit'));
  ({ exportPolicy } = await import('../lib/export'));
  ({ protectionMode } = await import('../lib/rights'));
  ({ licenseAllows } = await import('../lib/publisher'));
  ({ listReviews } = await import('../lib/reviews'));

  authorId = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('ap-author@test','Autor','author') RETURNING id",
  )).id;
  readerId = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('ap-reader@test','Čitalac','reader') RETURNING id",
  )).id;

  // Цена книги хранится в book_prices, а не в works — поэтому здесь её нет.
  const workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description, type, kind)
     VALUES ('ap-work', $1, 'sr', 'published', 'Zasticeno', '', 'novel', 'original') RETURNING id`,
    [authorId],
  )).id;

  const mk = async (access: string, number: number) => (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, status, price_cents)
     VALUES ($1,$2,'Glava','Тайный текст главы',$3,'published',100) RETURNING id`,
    [workId, number, access],
  )).id;

  freeChapter = await mk('free', 1);
  paidChapter = await mk('paid', 2);
  subsChapter = await mk('subscribers', 3);
});

describe('§7.11.7 приёмка: доступ к главам', () => {
  it('неавторизованный не получает платную главу', async () => {
    const gate = await chapterGate({ id: paidChapter, work_id: 1, access: 'paid' }, null);
    expect(gate.allowed).toBe(false);
  });

  it('неавторизованный не получает главу для подписчиков', async () => {
    const gate = await chapterGate({ id: subsChapter, work_id: 1, access: 'subscribers' }, null);
    expect(gate.allowed).toBe(false);
  });

  it('бесплатная глава доступна и гостю', async () => {
    const gate = await chapterGate({ id: freeChapter, work_id: 1, access: 'free' }, null);
    expect(gate.allowed).toBe(true);
  });

  it('чужой читатель без покупки не получает платную главу', async () => {
    const gate = await chapterGate({ id: paidChapter, work_id: 1, access: 'paid' }, { uid: readerId, role: 'reader' });
    expect(gate.allowed).toBe(false);
  });

  it('автор получает свой текст, админ — тоже', async () => {
    const asAuthor = await chapterGate({ id: paidChapter, work_id: 1, access: 'paid' }, { uid: authorId, role: 'author' });
    expect(asAuthor.allowed).toBe(true);
    const asAdmin = await chapterGate({ id: paidChapter, work_id: 1, access: 'paid' }, { uid: 999, role: 'admin' });
    expect(asAdmin.allowed).toBe(true);
  });
});

describe('§7.11.3 водяной знак', () => {
  it('кодирует идентификатор и не содержит персональных данных', () => {
    const mark = encodeId(4242);
    expect(decodeId(mark)).toBe(4242);
    expect(mark.includes('@')).toBe(false);
    expect(/[a-zA-Z0-9]/.test(mark)).toBe(false);
  });

  it('разные читатели получают разные метки', () => {
    const a = decodeId(encodeId(readerId));
    const b = decodeId(encodeId(authorId));
    expect(a).not.toBe(b);
  });
});

describe('§7.11.6 анти-скрейпинг', () => {
  it('массовые запросы ограничиваются', async () => {
    const key = `scrape:${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 6; i += 1) {
      results.push((await rateLimit(key, 3, 60_000)).ok);
    }
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(results.slice(3).every((ok) => ok === false)).toBe(true);
  });
});

describe('§7.11.5 режимы защиты издателя', () => {
  it('standard по умолчанию, DRM честно не подключён', () => {
    const info = protectionMode({ hasLicense: true });
    expect(info.mode).toBe('standard');
    expect(info.drmConnected).toBe(false);
    expect(info.notes.join(' ')).toContain('DRM');
  });

  it('watermark в лицензии включает enhanced', () => {
    const info = protectionMode({ exportPolicy: 'watermark', hasLicense: true });
    expect(info.mode).toBe('enhanced');
  });

  it('истёкшая лицензия закрывает права', () => {
    const license = {
      territory: 'RS', starts_at: null, ends_at: '2020-01-01T00:00:00Z',
      rights_sale: 1, rights_subscription: 1, rights_library: 1,
      tts_allowed: 1, translit_allowed: 1, export_policy: 'watermark',
    };
    expect(licenseAllows(license, { territory: 'RS', right: 'sale' })).toBe(false);
  });
});

describe('§7.11.7 приёмка: экспорт и скрытый контент', () => {
  it('платное произведение нельзя выгрузить в PDF', () => {
    const decision = exportPolicy(
      { id: 1, slug: 'ap-work', title: 'Zasticeno', author_id: authorId, author_name: 'Autor', is_classic: 0 },
      { uid: readerId, role: 'reader' },
    );
    expect(decision.allowed).toBe(false);
  });

  it('скрытый отзыв не попадает в выдачу', async () => {
    await one(
      `INSERT INTO reviews (user_id, work_id, rating, body, status)
       VALUES ($1, 1, 5, 'Скрытый отзыв с текстом', 'hidden')`,
      [readerId],
    );
    const list = await listReviews(1);
    expect(list.some((r) => r.body === 'Скрытый отзыв с текстом')).toBe(false);
  });
});
