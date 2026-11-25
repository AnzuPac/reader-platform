import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, dash: any, ids: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-dash-'));
  db = await import('../lib/db');
  await db.initSchema();
  dash = await import('../lib/author-dashboard');
  const u = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('d@test','x','D') RETURNING id`))[0].id;
  const other = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('o@test','x','O') RETURNING id`))[0].id;
  ids = { u, other };
  const w1 = (await db.query(`INSERT INTO works (slug,author_id,original_language,status,title,words_total) VALUES ('d1',$1,'sr','published','D1',30) RETURNING id`, [u]))[0].id;
  const w2 = (await db.query(`INSERT INTO works (slug,author_id,original_language,status,title,words_total) VALUES ('d2',$1,'sr','draft','D2',20) RETURNING id`, [u]))[0].id;
  await db.query(`INSERT INTO works (slug,author_id,original_language,status,title) VALUES ('other',$1,'sr','draft','Other')`, [other]);
  await db.query(`INSERT INTO chapters (work_id,number,title,content,status) VALUES ($1,1,'a','x','published')`, [w1]);
  await db.query(`INSERT INTO chapters (work_id,number,title,content,status) VALUES ($1,2,'b','x','draft')`, [w1]);
  await db.query(`INSERT INTO chapters (work_id,number,title,content,status,publish_at) VALUES ($1,1,'c','x','draft',$2)`, [w2, new Date(Date.now() + 3600000).toISOString()]);
});

describe('дашборд автора', () => {
  it('считает только свои произведения', async () => {
    const d = await dash.authorDashboard(ids.u);
    expect(d.totals.works).toBe(2);
    expect(d.totals.chapters).toBe(3);
    expect(d.totals.published).toBe(1);
    expect(d.totals.scheduled).toBe(1);
    expect(d.totals.words).toBe(50);
    expect(d.totals.pendingEdits).toBe(0);
  });
});
