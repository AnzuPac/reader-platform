import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>, query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>, initSchema: any, exportAccount: any, deleteAccount: any;
let uid = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-account-'));
  const db = await import('../lib/db');
  one = db.one as typeof one; query = db.query; initSchema = db.initSchema;
  const acc = await import('../lib/account');
  exportAccount = acc.exportAccount; deleteAccount = acc.deleteAccount;
  await initSchema();
  uid = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role, password_hash) VALUES ('me@example.com','Me','reader','x') RETURNING id"
  ))!.id;
  const other = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('other@example.com','Other','reader') RETURNING id"
  ))!.id;
  const authorId = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('author@example.com','Autor','author') RETURNING id"
  ))!.id;
  const workId = (await one<{ id: number }>(
    "INSERT INTO works (slug, author_id, original_language, title, status) VALUES ('test-work',$1,'sr','Test','published') RETURNING id",
    [authorId]
  ))!.id;
  await query("INSERT INTO donations (user_id, work_id, author_id, amount_cents, status) VALUES ($1, $3, $2, 500, 'paid')", [uid, authorId, workId]);
  await query("INSERT INTO donations (user_id, work_id, author_id, amount_cents, status) VALUES ($1, $3, $1, 700, 'paid')", [other, authorId, workId]);
});

describe('аккаунт: экспорт и удаление (ТЗ 7.6)', () => {
  it('экспорт содержит только свои данные', async () => {
    const d = await exportAccount(uid);
    expect(d.user.email).toBe('me@example.com');
    expect(d.donations.length).toBe(1);
    expect(d.donations[0].amount_cents).toBe(500);
    expect(JSON.stringify(d)).not.toContain('other@example.com');
  });

  it('удаление обезличивает и блокирует вход', async () => {
    await deleteAccount(uid);
    const u = await one<any>('SELECT email, display_name, password_hash, deleted_at FROM users WHERE id = $1', [uid]);
    expect(u.display_name).toBe('Obrisan nalog');
    expect(u.password_hash).toBeNull();
    expect(u.email).toContain('@invalid');
    expect(u.deleted_at).toBeTruthy();
    const left = await query('SELECT COUNT(*) AS n FROM users WHERE email = $1', ['me@example.com']);
    expect(Number((left[0] as any).n)).toBe(0);
  });
});
