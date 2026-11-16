import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: any, one: any, repo: any, search: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-search-'));
  const db = await import('../lib/db');
  query = db.query;
  one = db.one;
  await db.initSchema();
  repo = await import('../lib/repo');
  search = await import('../lib/search');
});

/** Произведение с уже посчитанным ключом поиска (как в реальном INSERT). */
async function addWork(opts: {
  slug: string; title: string; author: string; kind?: string; classic?: number;
  publisherId?: number | null; access?: string; tag?: string; completion?: string;
}) {
  const u = await one('SELECT id FROM users WHERE email = $1', [`author-${opts.slug}@test`])
    ?? (await query('INSERT INTO users (email, display_name) VALUES ($1,$2) RETURNING id',
      [`author-${opts.slug}@test`, opts.author]))[0];
  const w = await query(
    `INSERT INTO works (slug, author_id, publisher_id, original_language, status, title, description,
                        kind, is_classic, completion)
     VALUES ($1,$2,$3,'sr','published',$4,'opis',$5,$6,$7) RETURNING id`,
    [opts.slug, u.id, opts.publisherId ?? null, opts.title, opts.kind ?? 'original',
      opts.classic ?? 0, opts.completion ?? 'ongoing']
  );
  const workId = w[0].id;
  await query(
    `INSERT INTO chapters (work_id, number, title, content, status, access)
     VALUES ($1,1,'Glava 1','x','published',$2)`, [workId, opts.access ?? 'free']
  );
  if (opts.tag) {
    const t = await one('SELECT id FROM tags WHERE slug = $1', [opts.tag])
      ?? (await query('INSERT INTO tags (slug, name) VALUES ($1,$2) RETURNING id', [opts.tag, opts.tag]))[0];
    await query('INSERT INTO work_tags (work_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [workId, t.id]);
  }
  await search.refreshWorkSearchNorm(workId);
  return workId;
}

describe('поиск с транслитерацией (ТЗ 4.4)', () => {
  let andricId: number;

  beforeAll(async () => {
    // Издатель для «издательской» книги (FK на publishers).
    await query(
      `INSERT INTO publishers (name, slug, contact_email) VALUES ('Demo Izdavaštvo','demo-izdavastvo','x@test')
       ON CONFLICT (slug) DO NOTHING`
    );
    andricId = await addWork({ slug: 'na-drini', title: 'На Дрини ћуприја', author: 'Иво Андрић' });
    await addWork({ slug: 'publisher-book', title: 'Izdavačka knjiga', author: 'Petar Petrović', publisherId: 1, access: 'paid', tag: 'istorija' });
    await addWork({ slug: 'fanfic', title: 'Noćna straža', author: 'Ana Stanković', kind: 'fanfic', tag: 'horor' });
    await addWork({ slug: 'classic', title: 'Nečista krv', author: 'Borisav Stanković', classic: 1, completion: 'completed' });
  });

  it('«Андрић», «Andric», «Andrić» находят одно произведение', async () => {
    const a = await repo.listWorks({ q: 'Андрић' });
    const b = await repo.listWorks({ q: 'Andric' });
    const c = await repo.listWorks({ q: 'Andrić' });
    expect(a.map((w: any) => w.id)).toEqual([andricId]);
    expect(b.map((w: any) => w.id)).toEqual([andricId]);
    expect(c.map((w: any) => w.id)).toEqual([andricId]);
  });

  it('название ищется в любом письме и без диакритики', async () => {
    expect((await repo.listWorks({ q: 'ћуприја' })).map((w: any) => w.id)).toEqual([andricId]);
    expect((await repo.listWorks({ q: 'cuprija' })).map((w: any) => w.id)).toEqual([andricId]);
    expect((await repo.listWorks({ q: 'Na Drini' })).map((w: any) => w.id)).toEqual([andricId]);
  });

  it('автор ищется по кириллице и латинице', async () => {
    expect((await repo.listWorks({ q: 'Станковић' })).length).toBe(2);
    expect((await repo.listWorks({ q: 'Stankovic' })).length).toBe(2);
  });

  it('не находит чужое', async () => {
    expect(await repo.listWorks({ q: 'Tolstoj' })).toEqual([]);
  });

  it('фильтр по типу издания', async () => {
    expect((await repo.listWorks({ source: 'classic' })).map((w: any) => w.slug)).toEqual(['classic']);
    expect((await repo.listWorks({ source: 'fanfic' })).map((w: any) => w.slug)).toEqual(['fanfic']);
    const selfpub = await repo.listWorks({ source: 'selfpub' });
    expect(selfpub.map((w: any) => w.slug)).toEqual(['na-drini']);
    expect((await repo.listWorks({ source: 'publisher' })).map((w: any) => w.slug)).toEqual(['publisher-book']);
  });

  it('фильтры: бесплатно, завершено, тег и исключающий тег', async () => {
    expect((await repo.listWorks({ free: true })).length).toBe(3);
    expect((await repo.listWorks({ free: true, source: 'publisher' })).length).toBe(0);
    expect((await repo.listWorks({ completion: 'completed' })).map((w: any) => w.slug)).toEqual(['classic']);
    expect((await repo.listWorks({ tag: 'istorija' })).map((w: any) => w.slug)).toEqual(['publisher-book']);
    expect((await repo.listWorks({ excludeTags: ['istorija'] })).map((w: any) => w.slug).sort())
      .toEqual(['classic', 'fanfic', 'na-drini']);
  });
});
