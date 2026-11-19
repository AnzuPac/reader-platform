import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let fol: typeof import('../lib/follows');
let one: One;
let reader = 0;
let author = 0;
let plainUser = 0;
let workId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-follows-'));
  const db = await import('../lib/db');
  one = db.one as One;
  fol = await import('../lib/follows');
  await db.initSchema();

  reader = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('f-reader@test','Читатель','reader') RETURNING id",
  )).id;
  author = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('f-author@test','Автор','author') RETURNING id",
  )).id;
  plainUser = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('f-plain@test','Без книг','reader') RETURNING id",
  )).id;

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description, published_at)
     VALUES ('follow-work', $1, 'sr', 'published', 'Knjiga', '', $2) RETURNING id`,
    [author, new Date().toISOString()],
  )).id;
});

describe('подписка на автора', () => {
  it('на себя подписаться нельзя', async () => {
    expect(await fol.follow(author, author)).toEqual({ ok: false, reason: 'self' });
  });

  it('на пользователя без опубликованных книг нельзя', async () => {
    expect(await fol.follow(reader, plainUser)).toEqual({ ok: false, reason: 'not_author' });
  });

  it('подписка работает и не дублируется', async () => {
    expect(await fol.follow(reader, author)).toEqual({ ok: true, following: true });
    await fol.follow(reader, author);
    expect(await fol.followerCount(author)).toBe(1);
    expect(await fol.isFollowing(reader, author)).toBe(true);
  });

  it('список подписок содержит автора', async () => {
    const list = await fol.listFollowedAuthors(reader);
    expect(list.map((a) => a.id)).toContain(author);
  });

  it('новая глава автора попадает в ленту подписчика', async () => {
    await one(
      `INSERT INTO chapters (work_id, number, title, content, status, published_at)
       VALUES ($1, 1, 'Glava 1', 'текст', 'published', $2)`,
      [workId, new Date().toISOString()],
    );
    const feed = await fol.newChaptersFromFollowed(reader);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed[0].author_id).toBe(author);
    expect(await fol.countFollowUpdates(reader)).toBeGreaterThan(0);
  });

  it('отписка убирает из ленты и обнуляет счётчик', async () => {
    expect(await fol.unfollow(reader, author)).toEqual({ ok: true, following: false });
    expect(await fol.followerCount(author)).toBe(0);
    expect(await fol.newChaptersFromFollowed(reader)).toHaveLength(0);
  });
});
