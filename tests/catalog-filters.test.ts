import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let repo: any, query: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-filters-'));
  const db = await import('../lib/db');
  query = db.query;
  await db.initSchema();
  repo = await import('../lib/repo');
  const u = await query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ('filters@test','x','Filters','author') RETURNING id`,
  );
  const authorId = u[0].id;
  const mk = async (slug: string, ai: string, kind = 'original', type = 'novel') => {
    const r = await query(
      `INSERT INTO works (slug, author_id, original_language, status, title, description, kind, type, ai_usage)
       VALUES ($1,$2,'sr','published',$3,'desc',$4,$5,$6) RETURNING id`,
      [slug, authorId, slug, kind, type, ai],
    );
    return r[0].id as number;
  };
  const noai = await mk('w-noai', 'no_ai');
  const assisted = await mk('w-assisted', 'assisted');
  const generated = await mk('w-generated', 'generated');
  const undeclared = await mk('w-undeclared', 'not_declared');

  const magic = (await query(`INSERT INTO tags (slug, name) VALUES ('magic','Magic') RETURNING id`))[0].id;
  const dark = (await query(`INSERT INTO tags (slug, name) VALUES ('dark','Dark') RETURNING id`))[0].id;
  const link = (workId: number, tagId: number) =>
    query(`INSERT INTO work_tags (work_id, tag_id) VALUES ($1,$2)`, [workId, tagId]);
  await link(noai, magic);
  await link(assisted, magic);
  await link(assisted, dark);
  await link(generated, dark);
  await link(undeclared, magic);
});

const slugs = (rows: any[]) => rows.map((r) => r.slug).sort();

describe('AI-фильтр: три независимых состояния', () => {
  it('«использовался ИИ» включает assisted и generated', async () => {
    expect(slugs(await repo.listWorks({ aiUsages: ['used'] }))).toEqual(['w-assisted', 'w-generated']);
  });
  it('«без ИИ» — только no_ai', async () => {
    expect(slugs(await repo.listWorks({ aiUsages: ['no_ai'] }))).toEqual(['w-noai']);
  });
  it('«не указано» — только not_declared, не no_ai', async () => {
    expect(slugs(await repo.listWorks({ aiUsages: ['not_declared'] }))).toEqual(['w-undeclared']);
  });
  it('несколько галочек объединяются через OR', async () => {
    expect(slugs(await repo.listWorks({ aiUsages: ['no_ai', 'not_declared'] }))).toEqual(['w-noai', 'w-undeclared']);
  });
  it('пустой AI-фильтр не ограничивает', async () => {
    expect((await repo.listWorks({ aiUsages: [] })).length).toBe(4);
  });
});

describe('Include/Exclude тегов', () => {
  it('Include = все выбранные (AND по умолчанию)', async () => {
    expect(slugs(await repo.listWorks({ includeTags: ['magic', 'dark'] }))).toEqual(['w-assisted']);
  });
  it('Include = любой выбранный (OR)', async () => {
    expect(slugs(await repo.listWorks({ includeTags: ['magic', 'dark'], includeMode: 'any' })))
      .toEqual(['w-assisted', 'w-generated', 'w-noai', 'w-undeclared']);
  });
  it('Exclude убирает любое совпадение', async () => {
    expect(slugs(await repo.listWorks({ excludeTags: ['dark'] }))).toEqual(['w-noai', 'w-undeclared']);
  });
  it('Include и Exclude комбинируются через AND', async () => {
    expect(slugs(await repo.listWorks({ includeTags: ['magic'], excludeTags: ['dark'] }))).toEqual(['w-noai', 'w-undeclared']);
  });
});
