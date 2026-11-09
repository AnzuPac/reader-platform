import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: any, one: any, initSchema: any, repo: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-test-'));
  const db = await import('../lib/db');
  query = db.query; one = db.one; initSchema = db.initSchema;
  await initSchema();
  repo = await import('../lib/repo');
});

describe('база: произведения и главы', () => {
  it('создаёт пользователя-автора и произведение', async () => {
    const u = await query(
      `INSERT INTO users (email, password_hash, display_name, role) VALUES ('a@test','x','Автор','author') RETURNING id`
    );
    const w = await query(
      `INSERT INTO works (slug, author_id, original_language, status, title, description)
       VALUES ('test-work', $1, 'sr', 'published', 'Тест', 'Описание') RETURNING id`, [u[0].id]
    );
    const found = await repo.getWork('test-work');
    expect(found?.title).toBe('Тест');
  });

  it('главы сортируются по номеру', async () => {
    const w = await one(`SELECT id FROM works WHERE slug = 'test-work'`);
    await query(`INSERT INTO chapters (work_id, number, title, content, status) VALUES ($1,2,'Вторая','x','published')`, [w.id]);
    await query(`INSERT INTO chapters (work_id, number, title, content, status) VALUES ($1,1,'Первая','x','published')`, [w.id]);
    const chapters = await repo.listChapters(w.id);
    expect(chapters.map((c: any) => c.number)).toEqual([1, 2]);
  });
});

describe('библиотека', () => {
  it('добавляет и убирает произведение', async () => {
    const u = await one(`SELECT id FROM users WHERE email = 'a@test'`);
    const w = await one(`SELECT id FROM works WHERE slug = 'test-work'`);
    expect(await repo.isInLibrary(u.id, w.id)).toBe(false);
    expect(await repo.toggleLibrary(u.id, w.id)).toBe(true);
    expect(await repo.isInLibrary(u.id, w.id)).toBe(true);
    expect(await repo.toggleLibrary(u.id, w.id)).toBe(false);
  });
});

describe('рейтинг', () => {
  it('среднее пересчитывается после голосов', async () => {
    const w = await one(`SELECT id FROM works WHERE slug = 'test-work'`);
    const u1 = await query(`INSERT INTO users (email, display_name) VALUES ('r1@test','R1') RETURNING id`);
    const u2 = await query(`INSERT INTO users (email, display_name) VALUES ('r2@test','R2') RETURNING id`);
    await query(`INSERT INTO ratings (user_id, work_id, value) VALUES ($1,$2,5)`, [u1[0].id, w.id]);
    await query(`INSERT INTO ratings (user_id, work_id, value) VALUES ($1,$2,3)`, [u2[0].id, w.id]);
    const agg = await one(`SELECT CAST(COUNT(*) AS INTEGER) AS n, AVG(value) AS avg FROM ratings WHERE work_id = $1`, [w.id]);
    expect(agg.n).toBe(2);
    expect(Number(agg.avg)).toBe(4);
  });
});

describe('прогресс чтения', () => {
  it('обновляется, а не дублируется', async () => {
    const u = await one(`SELECT id FROM users WHERE email = 'r1@test'`);
    const w = await one(`SELECT id FROM works WHERE slug = 'test-work'`);
    const ch = await one(`SELECT id FROM chapters WHERE work_id = $1 ORDER BY number LIMIT 1`, [w.id]);
    await repo.saveProgress(u.id, w.id, ch.id, 100, 20);
    await repo.saveProgress(u.id, w.id, ch.id, 500, 60);
    const rows = await query(`SELECT position, percent FROM reading_progress WHERE user_id = $1 AND work_id = $2`, [u.id, w.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].position).toBe(500);
    const cont = await repo.getContinueReading(u.id);
    expect(cont?.chapter_id).toBe(ch.id);
  });
});

describe('жанры', () => {
  it('фильтрует каталог по жанру', async () => {
    const w = await one(`SELECT id FROM works WHERE slug = 'test-work'`);
    const g = await one(`SELECT id FROM genres WHERE slug = 'fantasy'`);
    await query(`INSERT INTO work_genres (work_id, genre_id) VALUES ($1,$2)`, [w.id, g.id]);
    const filtered = await repo.listWorks({ genre: 'fantasy' });
    expect(filtered.some((x: any) => x.slug === 'test-work')).toBe(true);
    const empty = await repo.listWorks({ genre: 'horror' });
    expect(empty.some((x: any) => x.slug === 'test-work')).toBe(false);
  });

  it('различает романы и комиксы', async () => {
    const u = await one(`SELECT id FROM users WHERE email = 'a@test'`);
    await query(`INSERT INTO works (slug, author_id, original_language, status, title, type)
                 VALUES ('test-comic', $1, 'sr', 'published', 'Комикс', 'comic')`, [u.id]);
    const comics = await repo.listWorks({ type: 'comic' });
    expect(comics.map((c: any) => c.slug)).toContain('test-comic');
    const novels = await repo.listWorks({ type: 'novel' });
    expect(novels.map((c: any) => c.slug)).not.toContain('test-comic');
  });
});
