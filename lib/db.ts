import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeSr } from './sr';

/**
 * Локально — встроенный SQLite (node:sqlite), без зависимостей и sudo.
 * В продакшене — PostgreSQL через DATABASE_URL (pg).
 */

type Row = Record<string, unknown>;

let sqlite: any = null;
let pgPool: any = null;
let ready = false;

export type MigrationFailure = { name: string; error: string };
const migrationFailures: MigrationFailure[] = [];

/** Неудачные миграции за текущий запуск — отдаём в /api/health и логируем. */
export function getMigrationFailures(): MigrationFailure[] {
  return migrationFailures;
}

function migrationName(sql: string): string {
  const flat = sql.trim().replace(/\s+/g, ' ');
  return flat.length > 90 ? flat.slice(0, 90) : flat;
}

/** Ожидаемые ошибки: колонка/таблица/индекс уже существуют. Всё остальное — не глотаем. */
function isExpectedMigrationError(msg: string): boolean {
  return /duplicate column|already exists|duplicate_column|42701|42P07|42710/i.test(msg);
}

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
    'ALTER TABLE works ADD COLUMN translit_allowed INTEGER',
    'ALTER TABLE users ADD COLUMN deleted_at TEXT',
    'ALTER TABLE users ADD COLUMN gender TEXT',
    'ALTER TABLE users ADD COLUMN birth_date TEXT',
    'ALTER TABLE users ADD COLUMN region TEXT',
    'ALTER TABLE works ADD COLUMN paragraph_comments_enabled INTEGER',
    'ALTER TABLE works ADD COLUMN rights_sale INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE works ADD COLUMN is_classic INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN gross_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN contributions_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN net_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN rights_subscription INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE works ADD COLUMN subscription_window_days INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN regions TEXT NOT NULL DEFAULT $$RS$$',
    'ALTER TABLE works ADD COLUMN tts_allowed INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN free_excerpt_pct INTEGER NOT NULL DEFAULT 10',
    // Комментарии к абзацам: колонки, которых не было в старой схеме main.
    'ALTER TABLE paragraph_comments ADD COLUMN text TEXT',
    'ALTER TABLE paragraph_comments ADD COLUMN work_id INTEGER',
    'ALTER TABLE paragraph_comments ADD COLUMN body TEXT',
    'ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'',
    'ALTER TABLE chapter_prices ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE purchases ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT',
    'ALTER TABLE subscriptions ADD COLUMN reminder_sent_at TEXT',
    'ALTER TABLE plans ADD COLUMN max_profiles SMALLINT NOT NULL DEFAULT 1',
    // Таксономия фанфиков и комиксов (аудит, п.29-30): без неё категории — просто ярлык.
    'ALTER TABLE works ADD COLUMN fandom TEXT',
    'ALTER TABLE works ADD COLUMN pairing TEXT',
    'ALTER TABLE works ADD COLUMN content_warnings TEXT',
    'ALTER TABLE works ADD COLUMN comic_format TEXT',
    "ALTER TABLE works ADD COLUMN reading_direction TEXT NOT NULL DEFAULT 'ltr'",
    // Счётчики частоты запросов: общие для инстансов, переживают рестарт.
    `CREATE TABLE IF NOT EXISTS rate_limit_buckets (
       scope_key TEXT PRIMARY KEY,
       hits      INTEGER NOT NULL DEFAULT 0,
       reset_at  TEXT NOT NULL
     )`,
  ];
  // Журнал миграций: раньше ошибки молча проглатывались и схема могла разъехаться (аудит, п.33).
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    status     TEXT NOT NULL,
    error      TEXT,
    updated_at TEXT NOT NULL
  )`);
  const recordSqlite = (name: string, status: string, error: string | null) => {
    try {
      db.prepare(
        `INSERT INTO schema_migrations (name, status, error, updated_at) VALUES (?,?,?,?)
         ON CONFLICT(name) DO UPDATE SET status = excluded.status, error = excluded.error, updated_at = excluded.updated_at`,
      ).run(name, status, error, new Date().toISOString());
    } catch { /* журнал не должен ломать старт */ }
  };
  for (const sql of alters) {
    const name = migrationName(sql);
    try {
      db.exec(sql);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (isExpectedMigrationError(msg)) continue;
      migrationFailures.push({ name, error: msg });
      console.error('[migrate:sqlite] failed:', name, '→', msg);
      recordSqlite(name, 'failed', msg);
    }
  }
  try { db.exec('CREATE INDEX IF NOT EXISTS works_publisher_idx ON works(publisher_id)'); } catch {}
  try { db.exec('UPDATE works SET translit_allowed = 0 WHERE publisher_id IS NOT NULL AND translit_allowed = 1'); } catch {}
  try { db.exec('UPDATE works SET paragraph_comments_enabled = 0 WHERE publisher_id IS NOT NULL AND paragraph_comments_enabled = 1'); } catch {}
  // Старые комментарии main лежали в body — переносим в text (новая фича читает его).
  try { db.exec("UPDATE paragraph_comments SET text = body WHERE (text IS NULL OR text = '') AND body IS NOT NULL"); } catch {}
  try {
    const rows = db.prepare("SELECT w.id, w.title, u.display_name FROM works w JOIN users u ON u.id = w.author_id WHERE w.search_norm IS NULL").all();
    for (const r of rows) {
      db.prepare('UPDATE works SET search_norm = ? WHERE id = ?').run(normalizeSr(String(r.title || '') + ' ' + String(r.display_name || '')), r.id);
    }
  } catch {}
  // Экономика v0.2: старые тарифы выключаем, цены глав переводим в монеты.
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
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS translit_allowed BOOLEAN',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS is_classic BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS paragraph_comments_enabled BOOLEAN',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS rights_sale SMALLINT NOT NULL DEFAULT 1',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS rights_subscription SMALLINT NOT NULL DEFAULT 1',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS subscription_window_days INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS regions TEXT NOT NULL DEFAULT 'RS'",
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS tts_allowed SMALLINT NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS free_excerpt_pct INTEGER NOT NULL DEFAULT 10',
    // Комментарии к абзацам: колонки, которых не было в старой схеме main.
    'ALTER TABLE paragraph_comments ADD COLUMN IF NOT EXISTS text TEXT',
    'ALTER TABLE paragraph_comments ADD COLUMN IF NOT EXISTS work_id BIGINT',
    'ALTER TABLE paragraph_comments ADD COLUMN IF NOT EXISTS body TEXT',
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT',
    'ALTER TABLE chapter_prices ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ',
    'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ',
    'ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_profiles SMALLINT NOT NULL DEFAULT 1',
    // Таксономия фанфиков и комиксов (аудит, п.29-30).
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS fandom TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS pairing TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS content_warnings TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS comic_format TEXT',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS reading_direction TEXT NOT NULL DEFAULT 'ltr'",
    // Счётчики частоты запросов: общие для инстансов, переживают рестарт.
    `CREATE TABLE IF NOT EXISTS rate_limit_buckets (
       scope_key TEXT PRIMARY KEY,
       hits      INTEGER NOT NULL DEFAULT 0,
       reset_at  TEXT NOT NULL
     )`,
  ];
  // Тот же журнал для Postgres: ожидаемые «уже существует» пропускаем,
  // остальные ошибки пишем в schema_migrations и в лог (аудит, п.33).
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    status     TEXT NOT NULL,
    error      TEXT,
    updated_at TEXT NOT NULL
  )`).catch(() => {});
  const recordPg = async (name: string, status: string, error: string | null) => {
    try {
      await db.query(
        `INSERT INTO schema_migrations (name, status, error, updated_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO UPDATE SET status = EXCLUDED.status, error = EXCLUDED.error, updated_at = EXCLUDED.updated_at`,
        [name, status, error, new Date().toISOString()],
      );
    } catch { /* журнал не должен ломать старт */ }
  };
  for (const sql of alters) {
    const name = migrationName(sql);
    try {
      await db.query(sql);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (isExpectedMigrationError(msg) || e?.code === '42701' || e?.code === '42P07' || e?.code === '42710') continue;
      migrationFailures.push({ name, error: msg });
      console.error('[migrate:pg] failed:', name, '→', msg);
      await recordPg(name, 'failed', msg);
    }
  }
  try { await db.query('CREATE INDEX IF NOT EXISTS works_search_norm_idx ON works(search_norm)'); } catch {}
  try { await db.query('UPDATE works SET translit_allowed = FALSE WHERE publisher_id IS NOT NULL AND translit_allowed = TRUE'); } catch {}
  // Старые комментарии main лежали в body — переносим в text (новая фича читает его).
  try { await db.query("UPDATE paragraph_comments SET text = body WHERE (text IS NULL OR text = '') AND body IS NOT NULL"); } catch {}
  try {
    const pending = await db.query(
      `SELECT w.id, w.title, u.display_name FROM works w JOIN users u ON u.id = w.author_id
        WHERE w.search_norm IS NULL OR w.search_norm = ''`
    );
    for (const r of pending.rows) {
      await db.query('UPDATE works SET search_norm = $1 WHERE id = $2', [normalizeSr(`${r.title} ${r.display_name}`), r.id]);
    }
  } catch {}
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
  try {
    await pgPool.query(schema);
  } catch (e: any) {
    // Таблицы уже созданы при первом старте — повторный прогон схемы безопасно пропускаем.
    if (e?.code !== '42P07') throw e;
  }
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

/** Хелперы, привязанные к одной транзакции (klijentу PG или общему SQLite). */
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
