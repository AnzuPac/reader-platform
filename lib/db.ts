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

async function migrateSqlite(db: any) {
  const alters = [
    'ALTER TABLE works ADD COLUMN font_family TEXT',
    'ALTER TABLE works ADD COLUMN font_path TEXT',
    'ALTER TABLE works ADD COLUMN publisher_id INTEGER REFERENCES publishers(id)',
    "ALTER TABLE works ADD COLUMN kind TEXT NOT NULL DEFAULT 'original'",
    'ALTER TABLE works ADD COLUMN exclusivity INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE works ADD COLUMN search_norm TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE works ADD COLUMN is_classic INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN translit_allowed INTEGER',
    'ALTER TABLE works ADD COLUMN paragraph_comments_enabled INTEGER',
    'ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'',
    'ALTER TABLE users ADD COLUMN deleted_at TEXT',
    'ALTER TABLE chapter_prices ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE purchases ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT',
    'ALTER TABLE subscriptions ADD COLUMN reminder_sent_at TEXT',
    'ALTER TABLE plans ADD COLUMN max_profiles SMALLINT NOT NULL DEFAULT 1',
  ];
  for (const sql of alters) { try { db.exec(sql); } catch {} }
  try { db.exec('CREATE INDEX IF NOT EXISTS works_publisher_idx ON works(publisher_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS works_search_norm_idx ON works(search_norm)'); } catch {}
  // Экономика v0.2: старые tarifaы выключаем, цены глав переводим в монеты.
  try { db.exec("UPDATE plans SET active = 0 WHERE code IN ('free','reader','reader_plus')"); } catch {}
  try { db.exec("UPDATE plans SET max_profiles = 5 WHERE code = 'family'"); } catch {}
  try {
    db.exec('UPDATE chapter_prices SET coins = CAST(ROUND(amount_cents / 100.0) AS INTEGER) WHERE coins = 0 AND amount_cents > 0');
    db.exec('UPDATE chapter_prices SET amount_cents = coins * 100 WHERE coins > 0');
  } catch {}
}

async function migratePg(db: any) {
  const alters = [
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS publisher_id BIGINT REFERENCES publishers(id) ON DELETE SET NULL',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'original'",
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS exclusivity BOOLEAN NOT NULL DEFAULT FALSE',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS search_norm TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS is_classic BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS translit_allowed BOOLEAN',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS paragraph_comments_enabled BOOLEAN',
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
    'ALTER TABLE chapter_prices ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ',
    'ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_profiles SMALLINT NOT NULL DEFAULT 1',
  ];
  for (const sql of alters) { try { await db.query(sql); } catch {} }
  try { await db.query('CREATE INDEX IF NOT EXISTS works_search_norm_idx ON works(search_norm)'); } catch {}
  try { await db.query("UPDATE plans SET active = FALSE WHERE code IN ('free','reader','reader_plus')"); } catch {}
  try { await db.query("UPDATE plans SET max_profiles = 5 WHERE code = 'family'"); } catch {}
  try {
    await db.query('UPDATE chapter_prices SET coins = ROUND(amount_cents / 100.0) WHERE coins = 0 AND amount_cents > 0');
    await db.query('UPDATE chapter_prices SET amount_cents = coins * 100 WHERE coins > 0');
  } catch {}
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
  await migrateSqlite(db);
  sqlite = db;
  return db;
}

async function initPg() {
  if (pgPool) return pgPool;
  const { Pool } = await import('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await pgPool.query(schema);
  await migratePg(pgPool);
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

/** Хелперы, привязанные к одной транзакции (клиенту PG или общему SQLite). */
export type Tx = {
  query: <T = Row>(sql: string, params?: unknown[]) => Promise<T[]>;
  one: <T = Row>(sql: string, params?: unknown[]) => Promise<T | null>;
};

/**
 * Транзакция для денежных операций. Внутри колбэка используйте переданный tx,
 * а не глобальный query — иначе в PostgreSQL запрос уйдёт из транзакции.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();

  if (process.env.DATABASE_URL) {
    const client = await db.connect();
    const tx: Tx = {
      query: async <R = Row>(sql: string, params: unknown[] = []) =>
        (await client.query(sql, params)).rows as R[],
      one: async <R = Row>(sql: string, params: unknown[] = []) =>
        ((await client.query(sql, params)).rows[0] ?? null) as R | null,
    };
    try {
      await client.query('BEGIN');
      const res = await fn(tx);
      await client.query('COMMIT');
      return res;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const res = await fn({ query, one });
    db.exec('COMMIT');
    return res;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }
}
