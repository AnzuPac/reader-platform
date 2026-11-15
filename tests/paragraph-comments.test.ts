import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let one: any, query: any, initSchema: any;
let selfWork = 0, pubWork = 0, chapterId = 0, readerId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-pc-'));
  const db = await import('../lib/db');
  one = db.one; query = db.query; initSchema = db.initSchema;
  await initSchema();
  const author = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('a@example.com','Autor','author') RETURNING id"
  ))!.id;
  const pub = (await one<{ id: number }>(
    "INSERT INTO publishers (name, slug, contact_email, commission_pct) VALUES ('Izd','izd','i@example.com',50) RETURNING id"
  ))!.id;
  selfWork = (await one<{ id: number }>(
    "INSERT INTO works (slug, author_id, original_language, title, status) VALUES ('self',$1,'sr','Self','published') RETURNING id", [author]
  ))!.id;
  pubWork = (await one<{ id: number }>(
    "INSERT INTO works (slug, author_id, publisher_id, original_language, title, status) VALUES ('pub',$1,$2,'sr','Pub','published') RETURNING id", [author, pub]
  ))!.id;
  chapterId = (await one<{ id: number }>(
    "INSERT INTO chapters (work_id, number, title, content, access, status) VALUES ($1,1,'G1','Tekst','free','published') RETURNING id", [selfWork]
  ))!.id;
  readerId = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('r@example.com','Citalac','reader') RETURNING id"
  ))!.id;
});

describe('комментарии к абзацам (ТЗ 4.6, 5.4)', () => {
  it('для издательской книги комментарии выключены, для самиздата — включены', async () => {
    const self = await one<any>('SELECT paragraph_comments_enabled AS e FROM works WHERE id = $1', [selfWork]);
    const pub = await one<any>('SELECT paragraph_comments_enabled AS e FROM works WHERE id = $1', [pubWork]);
    expect(Number(self.e)).toBe(1);
    expect(Number(pub.e)).toBe(0);
  });

  it('комментарий привязывается к абзацу', async () => {
    await query(
      "INSERT INTO paragraph_comments (chapter_id, work_id, paragraph_index, user_id, body) VALUES ($1,$2,2,$3,'Prvi')",
      [chapterId, selfWork, readerId]
    );
    const rows = await query(
      `SELECT pc.paragraph_index, pc.body, u.display_name AS author
         FROM paragraph_comments pc JOIN users u ON u.id = pc.user_id
        WHERE pc.chapter_id = $1 AND pc.hidden = 0`, [chapterId]
    );
    expect(rows.length).toBe(1);
    expect((rows[0] as any).paragraph_index).toBe(2);
    expect((rows[0] as any).author).toBe('Citalac');
  });

  it('скрытый комментарий не отдаётся в выборке', async () => {
    await query('UPDATE paragraph_comments SET hidden = 1 WHERE chapter_id = $1', [chapterId]);
    const rows = await query('SELECT id FROM paragraph_comments WHERE chapter_id = $1 AND hidden = 0', [chapterId]);
    expect(rows.length).toBe(0);
  });
});
