import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Локальная БД: PGlite (Postgres в WASM) — не требует установки и sudo.
 * В продакшене заменяется на обычный PostgreSQL через переменную DATABASE_URL.
 */

let _db: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (_db) return _db;
  _db = new PGlite(process.env.PGLITE_DIR || path.join(process.cwd(), 'data', 'pglite'));
  await _db.waitReady;
  return _db;
}

export async function initSchema(): Promise<void> {
  const db = await getDb();
  const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await db.exec(schema);
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(sql, params as never[]);
  return (res.rows ?? []) as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
