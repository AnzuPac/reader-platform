import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, pub: any, ids: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-pub-'));
  db = await import('../lib/db');
  await db.initSchema();
  pub = await import('../lib/publish');
  const u = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('p@test','x','P') RETURNING id`))[0].id;
  const w = (await db.query(`INSERT INTO works (slug,author_id,original_language,status,title) VALUES ('pwork',$1,'sr','published','P') RETURNING id`, [u]))[0].id;
  const ch = (await db.query(`INSERT INTO chapters (work_id,number,title,content,status) VALUES ($1,1,'G1','x','draft') RETURNING id`, [w]))[0].id;
  ids = { u, w, ch };
});

describe('расписание публикации', () => {
  it('будущая дата не публикует главу', async () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    await pub.scheduleChapter(ids.w, 1, future);
    expect(await pub.publishDue(ids.w)).toBe(0);
    const row = await db.one('SELECT status FROM chapters WHERE id = $1', [ids.ch]);
    expect(row.status).toBe('draft');
  });
  it('наступившая дата публикует', async () => {
    const past = new Date(Date.now() - 60000).toISOString();
    await pub.scheduleChapter(ids.w, 1, past);
    expect(await pub.publishDueIfAny(ids.w)).toBe(1);
    const row = await db.one('SELECT status FROM chapters WHERE id = $1', [ids.ch]);
    expect(row.status).toBe('published');
  });
});
