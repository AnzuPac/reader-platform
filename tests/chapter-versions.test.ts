import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, versions: any, ids: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-versions-'));
  db = await import('../lib/db');
  await db.initSchema();
  versions = await import('../lib/chapter-versions');
  const u1 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('v1@test','x','V1') RETURNING id`))[0].id;
  const u2 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('v2@test','x','V2') RETURNING id`))[0].id;
  const w = (await db.query(`INSERT INTO works (slug,author_id,original_language,status,title) VALUES ('vwork',$1,'sr','published','Vork') RETURNING id`, [u1]))[0].id;
  const ch = (await db.query(`INSERT INTO chapters (work_id,number,title,content,status) VALUES ($1,1,'G1','text','draft') RETURNING id`, [w]))[0].id;
  ids = { u1, u2, w, ch };
});

describe('версии главы', () => {
  it('сохраняет версию и пропускает дубль в окне 10 минут', async () => {
    const first = await versions.saveVersion({ chapterId: ids.ch, workId: ids.w, userId: ids.u1, number: 1, title: 'G1', content: '<p>one</p>', wordCount: 1 });
    expect(first.skipped).toBe(false);
    const second = await versions.saveVersion({ chapterId: ids.ch, workId: ids.w, userId: ids.u1, number: 1, title: 'G1', content: '<p>one</p>', wordCount: 1 });
    expect(second.skipped).toBe(true);
    expect(second.versionId).toBe(first.versionId);
  });

  it('держит не больше 50 версий на главу', async () => {
    for (let i = 0; i < 55; i++) {
      await versions.saveVersion({ chapterId: ids.ch, workId: ids.w, userId: ids.u1, number: 1, title: 'G1', content: `<p>v${i}</p>`, wordCount: 1 });
    }
    const list = await versions.listVersions(ids.ch, 100);
    expect(list.length).toBe(50);
  });

  it('версию видит только владелец произведения', async () => {
    const list = await versions.listVersions(ids.ch, 1);
    const own = await versions.getVersionForUser(list[0].id, ids.u1);
    const other = await versions.getVersionForUser(list[0].id, ids.u2);
    expect(own?.id).toBe(list[0].id);
    expect(other).toBeNull();
  });
});
