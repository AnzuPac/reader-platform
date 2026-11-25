import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, ann: any, ids: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-ann-'));
  db = await import('../lib/db');
  await db.initSchema();
  ann = await import('../lib/annotations');
  const u1 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('a1@test','x','A1') RETURNING id`))[0].id;
  const u2 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('a2@test','x','A2') RETURNING id`))[0].id;
  const w = (await db.query(`INSERT INTO works (slug,author_id,original_language,status,title) VALUES ('aw',$1,'sr','published','AW') RETURNING id`, [u1]))[0].id;
  const ch = (await db.query(`INSERT INTO chapters (work_id,number,title,content,status) VALUES ($1,1,'a','x','published') RETURNING id`, [w]))[0].id;
  ids = { u1, u2, ch };
});

describe('заметки и выделения', () => {
  it('создаёт и перечисляет', async () => {
    const a = await ann.createAnnotation(ids.u1, ids.ch, { position: 10, length: 5, note: 'важно', color: 'yellow' });
    expect(a.client_id).toBeTruthy();
    const list = await ann.listAnnotations(ids.u1, ids.ch);
    expect(list.length).toBe(1);
    expect(list[0].note).toBe('важно');
  });
  it('чужой пользователь не видит', async () => {
    const list = await ann.listAnnotations(ids.u2, ids.ch);
    expect(list.length).toBe(0);
  });
  it('удаление мягкое, чужим нельзя', async () => {
    const list = await ann.listAnnotations(ids.u1, ids.ch);
    expect(await ann.deleteAnnotation(ids.u2, list[0].client_id)).toBe(false);
    expect(await ann.deleteAnnotation(ids.u1, list[0].client_id)).toBe(true);
    expect((await ann.listAnnotations(ids.u1, ids.ch)).length).toBe(0);
  });
  it('ограничивает длину заметки', async () => {
    const a = await ann.createAnnotation(ids.u1, ids.ch, { position: 0, length: 99999, note: 'x'.repeat(5000) });
    expect(a.length).toBe(5000);
    expect(String(a.note).length).toBe(2000);
  });
});
