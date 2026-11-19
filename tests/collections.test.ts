import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let col: typeof import('../lib/collections');
let one: One;
let u1 = 0;
let u2 = 0;
let workId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-collections-'));
  const db = await import('../lib/db');
  one = db.one as One;
  col = await import('../lib/collections');
  await db.initSchema();

  u1 = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('c1@test','C1','reader') RETURNING id",
  )).id;
  u2 = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('c2@test','C2','reader') RETURNING id",
  )).id;
  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description)
     VALUES ('col-work', $1, 'sr', 'published', 'Delo', '') RETURNING id`,
    [u1],
  )).id;
});

describe('коллекции', () => {
  it('создаёт коллекцию со slug', async () => {
    const c = await col.createCollection(u1, { title: 'Moje omiljeno' });
    expect(c.id).toBeGreaterThan(0);
    expect(c.slug).toBe('moje-omiljeno');
    expect(c.kind).toBe('user');
  });

  it('не даёт двум коллекциям одинаковый slug', async () => {
    const a = await col.createCollection(u1, { title: 'Isto ime' });
    const b = await col.createCollection(u1, { title: 'Isto ime' });
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug.startsWith('isto-ime')).toBe(true);
  });

  it('владелец добавляет произведение, дубль не появляется', async () => {
    const c = await col.createCollection(u1, { title: 'Sa delom' });
    const viewer = { uid: u1, role: 'reader' };
    expect(await col.addWorkToCollection(viewer, c.id, workId)).toBe(true);
    expect(await col.addWorkToCollection(viewer, c.id, workId)).toBe(true);

    const data = await col.getCollectionBySlug(c.slug, viewer);
    expect(data?.items).toHaveLength(1);
  });

  it('чужой пользователь не может править коллекцию', async () => {
    const c = await col.createCollection(u1, { title: 'Privatna stvar' });
    const other = { uid: u2, role: 'reader' };
    expect(await col.addWorkToCollection(other, c.id, workId)).toBe(false);
    expect(await col.deleteCollection(other, c.id)).toBe(false);
    expect(await col.updateCollection(other, c.id, { title: 'Hak' })).toBe(false);
  });

  it('приватная коллекция не видна другим и не открывается по ссылке', async () => {
    const c = await col.createCollection(u1, { title: 'Tajna', isPublic: false });
    const publicList = await col.listCollections(null);
    expect(publicList.some((x) => x.id === c.id)).toBe(false);

    const ownerView = await col.getCollectionBySlug(c.slug, { uid: u1, role: 'reader' });
    expect(ownerView).not.toBeNull();

    const otherView = await col.getCollectionBySlug(c.slug, { uid: u2, role: 'reader' });
    expect(otherView).toBeNull();
  });

  it('удаление произведения из коллекции', async () => {
    const c = await col.createCollection(u1, { title: 'Uklanjanje' });
    const viewer = { uid: u1, role: 'reader' };
    await col.addWorkToCollection(viewer, c.id, workId);
    expect(await col.removeWorkFromCollection(viewer, c.id, workId)).toBe(true);
    const data = await col.getCollectionBySlug(c.slug, viewer);
    expect(data?.items).toHaveLength(0);
  });

  it('системные коллекции создаются один раз', async () => {
    await col.ensureSystemCollections();
    const first = await col.listCollections(null);
    const systemCount = first.filter((c) => c.kind === 'system').length;
    expect(systemCount).toBeGreaterThan(0);

    await col.ensureSystemCollections();
    const second = await col.listCollections(null);
    expect(second.filter((c) => c.kind === 'system').length).toBe(systemCount);
  });
});
