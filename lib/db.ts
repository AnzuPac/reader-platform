import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Локально — встроенный SQLite (node:sqlite), без зависимостей и sudo.
 * В продакшене — PostgreSQL через DATABASE_URL (pg).
 */

type Row = Record<string, unknown>;

let sqlite: any = null;
let pgPool: any = null;
let ready = false;

function toSqlite(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const out: unknown[] = [];
  const converted = sql
    .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)/g, (_m, n: string) => {
      out.push(params[Number(n) - 1]);
      return '?';
    });
  return { sql: converted, params: out };
}

async function initSqlite() {
  if (sqlite) return sqlite;
  const { DatabaseSync } = await import('node:sqlite');
  const dir = process.env.SQLITE_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'reader.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sqlite.sql'), 'utf8');
  db.exec(schema);
  sqlite = db;
  return db;
}

async function initPg() {
  if (pgPool) return pgPool;
  const { Pool } = await import('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await pgPool.query(schema);
  return pgPool;
}

export async function getDb() {
  return process.env.DATABASE_URL ? await initPg() : await initSqlite();
}

export async function initSchema(): Promise<void> {
  if (ready) return;
  await getDb();
  ready = true;
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  if (process.env.DATABASE_URL) {
    const res = await db.query(sql, params);
    return res.rows as T[];
  }
  const conv = toSqlite(sql, params);
  const stmt = db.prepare(conv.sql);
  const rows = stmt.all(...(conv.params as never[]));
  return rows as T[];
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
