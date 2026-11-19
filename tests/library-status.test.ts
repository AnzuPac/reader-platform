import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let repo: typeof import('../lib/repo');
let one: One;
let uid = 0;
let workId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-libstatus-'));
  const db = await import('../lib/db');
  one = db.one as One;
  repo = await import('../lib/repo');
  await db.initSchema();

  uid = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('lib@test','Lib','reader') RETURNING id",
  )).id;
  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description)
     VALUES ('lib-work', $1, 'sr', 'published', 'Knjiga', '') RETURNING id`,
    [uid],
  )).id;
});

describe('статусы библиотеки', () => {
  it('ставит статус и читает его обратно', async () => {
    const res = await repo.setLibraryStatus(uid, workId, 'reading');
    expect(res).toBe('reading');
    expect(await repo.getLibraryStatus(uid, workId)).toBe('reading');
  });

  it('смена статуса не создаёт дубль и обновляет счётчики', async () => {
    await repo.setLibraryStatus(uid, workId, 'done');
    const counts = await repo.libraryCounts(uid);
    expect(counts.done).toBe(1);
    expect(counts.reading).toBe(0);

    const rows = await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM library_items WHERE user_id = $1 AND work_id = $2', [uid, workId],
    );
    expect(Number(rows.n)).toBe(1);
  });

  it('фильтр по статусу возвращает только нужные книги', async () => {
    const done = await repo.listLibrary(uid, 'done');
    expect(done.some((w) => w.id === workId)).toBe(true);

    const reading = await repo.listLibrary(uid, 'reading');
    expect(reading.some((w) => w.id === workId)).toBe(false);
  });

  it('«убрать» удаляет запись из библиотеки', async () => {
    const res = await repo.setLibraryStatus(uid, workId, 'remove');
    expect(res).toBeNull();
    expect(await repo.isInLibrary(uid, workId)).toBe(false);
    expect(await repo.getLibraryStatus(uid, workId)).toBeNull();
  });

  it('кнопка «добавить» ставит статус «в планах»', async () => {
    const added = await repo.toggleLibrary(uid, workId);
    expect(added).toBe(true);
    expect(await repo.getLibraryStatus(uid, workId)).toBe('want');
  });

  it('неизвестный статус не принимается валидатором', () => {
    expect(repo.isLibraryStatus('reading')).toBe(true);
    expect(repo.isLibraryStatus('hacked')).toBe(false);
    expect(repo.isLibraryStatus(null)).toBe(false);
  });
});
