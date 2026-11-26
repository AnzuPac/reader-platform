import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, repo: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-lang-'));
  db = await import('../lib/db');
  await db.initSchema();
  repo = await import('../lib/repo');
  const u = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('lang@test','x','L') RETURNING id`))[0].id;
  for (const [slug, lang] of [['l-ru','ru'],['l-sr','sr'],['l-en','en']] as const) {
    await db.query(`INSERT INTO works (slug,author_id,original_language,status,title) VALUES ($1,$2,$3,'published',$4)`, [slug,u,lang,slug]);
  }
});

describe('фильтр языка произведений', () => {
  it('возвращает только выбранный язык', async () => {
    const ru = await repo.listWorks({ language: 'ru' });
    expect(ru.map((w: any) => w.slug)).toEqual(['l-ru']);
    const en = await repo.listWorks({ language: 'en' });
    expect(en.map((w: any) => w.slug)).toEqual(['l-en']);
  });
  it('без фильтра — все три', async () => {
    const all = await repo.listWorks({});
    expect(all.length).toBe(3);
  });
});

import { can } from '../lib/publisher';
describe('матрица прав Publisher', () => {
  it('member не получает финансы и персонал', () => {
    expect(can('member', 'catalog')).toBe(true);
    expect(can('member', 'finances')).toBe(false);
    expect(can('member', 'staff')).toBe(false);
  });
  it('manager получает финансы, но не персонал', () => {
    expect(can('manager', 'finances')).toBe(true);
    expect(can('manager', 'licenses')).toBe(true);
    expect(can('manager', 'staff')).toBe(false);
  });
  it('owner и admin получают всё', () => {
    for (const cap of ['staff', 'finances', 'catalog', 'licenses'] as const) {
      expect(can('owner', cap)).toBe(true);
      expect(can('admin', cap)).toBe(true);
    }
  });
});
