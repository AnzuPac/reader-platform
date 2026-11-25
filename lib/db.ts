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
    // Postgres dollar-quoting ($$RS$$) в SQLite — синтаксическая ошибка: разворачиваем в строку.
    .replace(/\$\$([^$]*)\$\$/g, "'$1'")
    .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)/g, (_m, n: string) => {
      const v = params[Number(n) - 1];
      // node:sqlite не принимает boolean: в SQLite это 1/0.
      out.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
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
    'ALTER TABLE works ADD COLUMN rights_confirmed INTEGER NOT NULL DEFAULT 1',
    "ALTER TABLE works ADD COLUMN ai_usage TEXT NOT NULL DEFAULT 'not_declared'",
    'ALTER TABLE author_payouts ADD COLUMN gross_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN contributions_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE author_payouts ADD COLUMN net_cents INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE works ADD COLUMN rights_subscription INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE works ADD COLUMN subscription_window_days INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE works ADD COLUMN regions TEXT NOT NULL DEFAULT 'RS'",
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
    // Статусы библиотеки: читаю / в планах / прочитано / любимое / отложено / брошено.
    "ALTER TABLE library_items ADD COLUMN status TEXT NOT NULL DEFAULT 'want'",
    'ALTER TABLE library_items ADD COLUMN updated_at TEXT',
    // Таксономия фанфиков и комиксов (аудит, п.29-30): без неё категории — просто ярлык.
    'ALTER TABLE works ADD COLUMN fandom TEXT',
    'ALTER TABLE works ADD COLUMN pairing TEXT',
    'ALTER TABLE works ADD COLUMN content_warnings TEXT',
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id BIGINT NOT NULL,
       token_hash TEXT NOT NULL UNIQUE,
       expires_at TEXT NOT NULL,
       used_at TEXT,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    'ALTER TABLE works ADD COLUMN comic_format TEXT',
    'ALTER TABLE works ADD COLUMN color_mode TEXT',
    'ALTER TABLE works ADD COLUMN demographic TEXT',
    "ALTER TABLE works ADD COLUMN reading_direction TEXT NOT NULL DEFAULT 'ltr'",
    // День рождения: подарок выдаётся один раз в год, поэтому нужен журнал.
    `CREATE TABLE IF NOT EXISTS birthday_gifts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       gift_year INTEGER NOT NULL,
       coins INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL,
       UNIQUE (user_id, gift_year)
     )`,
    // Настройки платформы (пока — подарок на день рождения и подобное).
    `CREATE TABLE IF NOT EXISTS app_settings (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL
     )`,
    // Коллекции: системные, редакционные и пользовательские (мастер-промпт §2).
    `CREATE TABLE IF NOT EXISTS collections (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       slug TEXT UNIQUE NOT NULL,
       title TEXT NOT NULL,
       description TEXT NOT NULL DEFAULT '',
       kind TEXT NOT NULL DEFAULT 'user',
       owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
       is_public INTEGER NOT NULL DEFAULT 1,
       position INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS collection_items (
       collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       position INTEGER NOT NULL DEFAULT 0,
       added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (collection_id, work_id)
     )`,
    // Отзывы: текст + оценка, только от читателей с прогрессом >= 10%.
    `CREATE TABLE IF NOT EXISTS reviews (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       rating SMALLINT,
       body TEXT NOT NULL DEFAULT '',
       status TEXT NOT NULL DEFAULT 'visible',
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE (user_id, work_id)
     )`,
    `CREATE INDEX IF NOT EXISTS reviews_work_idx ON reviews(work_id, created_at DESC)`,
    // Жалобы и очередь модерации.
    `CREATE TABLE IF NOT EXISTS reports (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       reporter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
       target_type TEXT NOT NULL,
       target_id BIGINT NOT NULL,
       reason TEXT NOT NULL,
       comment TEXT,
       status TEXT NOT NULL DEFAULT 'open',
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       resolved_at TEXT,
       resolved_by TEXT
     )`,
    `CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at DESC)`,
    // Профиль: описание, аватар, публичность.
    'ALTER TABLE users ADD COLUMN bio TEXT',
    'ALTER TABLE users ADD COLUMN avatar_path TEXT',
    'ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 1',
    // Подписка на автора: уведомления о новых главах.
    `CREATE TABLE IF NOT EXISTS author_follows (
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, author_id)
     )`,
    `CREATE INDEX IF NOT EXISTS author_follows_author_idx ON author_follows(author_id)`,
    // Лицензия издателя на произведение: территория, срок, права.
    `CREATE TABLE IF NOT EXISTS work_licenses (
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       publisher_id BIGINT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
       territory TEXT NOT NULL DEFAULT 'RS',
       starts_at TEXT,
       ends_at TEXT,
       rights_sale INTEGER NOT NULL DEFAULT 1,
       rights_subscription INTEGER NOT NULL DEFAULT 0,
       rights_library INTEGER NOT NULL DEFAULT 0,
       tts_allowed INTEGER NOT NULL DEFAULT 0,
       translit_allowed INTEGER NOT NULL DEFAULT 0,
       export_policy TEXT NOT NULL DEFAULT 'disallowed',
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (work_id, publisher_id)
     )`,
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
  // Топы по периодам: суммарного views_total мало — нужна история просмотров.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS work_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS work_views_work_idx ON work_views(work_id, created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS work_views_created_idx ON work_views(created_at)');
  } catch (e: any) {
    migrationFailures.push({ name: 'work_views', error: String(e?.message || e) });
  }


  // Профиль читателя: настройки, журнал чтения, достижения.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS user_profile (
      user_id INTEGER PRIMARY KEY,
      bio TEXT,
      cover_url TEXT,
      public_profile INTEGER NOT NULL DEFAULT 1,
      show_history INTEGER NOT NULL DEFAULT 1,
      show_library INTEGER NOT NULL DEFAULT 1,
      show_bookmarks INTEGER NOT NULL DEFAULT 1,
      show_achievements INTEGER NOT NULL DEFAULT 1,
      show_genres INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS reading_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      work_id INTEGER NOT NULL,
      chapter_id INTEGER,
      event_type TEXT NOT NULL DEFAULT 'opened',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS reading_events_user_idx ON reading_events(user_id, created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS reading_events_chapter_idx ON reading_events(user_id, chapter_id)');
    db.exec(`CREATE TABLE IF NOT EXISTS achievement_definitions (
      key TEXT PRIMARY KEY,
      title_sr TEXT NOT NULL, title_ru TEXT NOT NULL, title_en TEXT NOT NULL,
      desc_sr TEXT NOT NULL, desc_ru TEXT NOT NULL, desc_en TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '★',
      category TEXT NOT NULL DEFAULT 'reading',
      threshold INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL,
      achievement_key TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      progress INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, achievement_key)
    )`);
    const seed = [
      ['first_read','Prvo čitanje','Первое чтение','First read','Otvorena prva glava.','Открыта первая глава.','Opened the first chapter.','📖','reading',1],
      ['chapters_10','10 glava','10 глав','10 chapters','Pročitano 10 glava.','Прочитано 10 глав.','Read 10 chapters.','📚','reading',10],
      ['chapters_50','50 glava','50 глав','50 chapters','Pročitano 50 glava.','Прочитано 50 глав.','Read 50 chapters.','📚','reading',50],
      ['chapters_100','100 glava','100 глав','100 chapters','Pročitano 100 glava.','Прочитано 100 глав.','Read 100 chapters.','🏆','reading',100],
      ['first_bookmark','Prva zabeleška','Первая закладка','First bookmark','Sačuvana prva zabeleška.','Сохранена первая закладка.','Saved the first bookmark.','🔖','social',1],
      ['library_first','Prvo delo u biblioteci','Первое произведение в библиотеке','First work in library','Delo je dodato u biblioteku.','Произведение добавлено в библиотеку.','Added a work to the library.','📌','social',1],
      ['first_completed','Prvo završeno delo','Первое завершённое произведение','First completed work','Delo je označeno kao završeno.','Произведение отмечено завершённым.','Marked a work as completed.','✅','reading',1],
    ];
    const ins = db.prepare('INSERT OR IGNORE INTO achievement_definitions (key,title_sr,title_ru,title_en,desc_sr,desc_ru,desc_en,icon,category,threshold) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const row of seed) ins.run(...row);
  } catch (e: any) {
    migrationFailures.push({ name: 'reader_profile', error: String(e?.message || e) });
  }
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
  // Монетизация: fanfic и public-domain作品 переводятся в бесплатный доступ; донаты не затрагиваются.
  try { db.exec("UPDATE chapters SET access = 'free', price_cents = 0 WHERE work_id IN (SELECT id FROM works WHERE kind = 'fanfic' OR is_classic = 1) AND access = 'paid'"); } catch {}
  try { db.exec("UPDATE chapter_prices SET active = 0 WHERE chapter_id IN (SELECT c.id FROM chapters c JOIN works w ON w.id = c.work_id WHERE w.kind = 'fanfic' OR w.is_classic = 1)"); } catch {}
  try { db.exec("UPDATE book_prices SET active = 0 WHERE work_id IN (SELECT id FROM works WHERE kind = 'fanfic' OR is_classic = 1)"); } catch {}
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
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS rights_confirmed BOOLEAN NOT NULL DEFAULT TRUE',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS ai_usage TEXT NOT NULL DEFAULT 'not_declared'",
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
    // Статусы библиотеки.
    "ALTER TABLE library_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'want'",
    'ALTER TABLE library_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ',
    // Таксономия фанфиков и комиксов (аудит, п.29-30).
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS fandom TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS pairing TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS content_warnings TEXT',
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       id BIGSERIAL PRIMARY KEY,
       user_id BIGINT NOT NULL,
       token_hash TEXT NOT NULL UNIQUE,
       expires_at TIMESTAMPTZ NOT NULL,
       used_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS comic_format TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS color_mode TEXT',
    'ALTER TABLE works ADD COLUMN IF NOT EXISTS demographic TEXT',
    "ALTER TABLE works ADD COLUMN IF NOT EXISTS reading_direction TEXT NOT NULL DEFAULT 'ltr'",
    // День рождения: подарок выдаётся один раз в год, поэтому нужен журнал.
    `CREATE TABLE IF NOT EXISTS birthday_gifts (
       id BIGSERIAL PRIMARY KEY,
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       gift_year INTEGER NOT NULL,
       coins INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL,
       UNIQUE (user_id, gift_year)
     )`,
    // Настройки платформы.
    `CREATE TABLE IF NOT EXISTS app_settings (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at TEXT NOT NULL
     )`,
    // Отзывы: текст + оценка, только от читателей с прогрессом >= 10%.
    `CREATE TABLE IF NOT EXISTS reviews (
       id BIGSERIAL PRIMARY KEY,
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       rating SMALLINT,
       body TEXT NOT NULL DEFAULT '',
       status TEXT NOT NULL DEFAULT 'visible',
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       UNIQUE (user_id, work_id)
     )`,
    `CREATE INDEX IF NOT EXISTS reviews_work_idx ON reviews(work_id, created_at DESC)`,
    // Жалобы и очередь модерации.
    `CREATE TABLE IF NOT EXISTS reports (
       id BIGSERIAL PRIMARY KEY,
       reporter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
       target_type TEXT NOT NULL,
       target_id BIGINT NOT NULL,
       reason TEXT NOT NULL,
       comment TEXT,
       status TEXT NOT NULL DEFAULT 'open',
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       resolved_at TIMESTAMPTZ,
       resolved_by TEXT
     )`,
    `CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at DESC)`,
    // Профиль: описание, аватар, публичность.
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public BOOLEAN NOT NULL DEFAULT TRUE',
    // Подписка на автора: уведомления о новых главах.
    `CREATE TABLE IF NOT EXISTS author_follows (
       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       PRIMARY KEY (user_id, author_id)
     )`,
    `CREATE INDEX IF NOT EXISTS author_follows_author_idx ON author_follows(author_id)`,
    // Лицензия издателя на произведение: территория, срок, права.
    `CREATE TABLE IF NOT EXISTS work_licenses (
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       publisher_id BIGINT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
       territory TEXT NOT NULL DEFAULT 'RS',
       starts_at TIMESTAMPTZ,
       ends_at TIMESTAMPTZ,
       rights_sale BOOLEAN NOT NULL DEFAULT TRUE,
       rights_subscription BOOLEAN NOT NULL DEFAULT FALSE,
       rights_library BOOLEAN NOT NULL DEFAULT FALSE,
       tts_allowed BOOLEAN NOT NULL DEFAULT FALSE,
       translit_allowed BOOLEAN NOT NULL DEFAULT FALSE,
       export_policy TEXT NOT NULL DEFAULT 'disallowed',
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       PRIMARY KEY (work_id, publisher_id)
     )`,
    // Коллекции: системные, редакционные и пользовательские.
    `CREATE TABLE IF NOT EXISTS collections (
       id BIGSERIAL PRIMARY KEY,
       slug TEXT UNIQUE NOT NULL,
       title TEXT NOT NULL,
       description TEXT NOT NULL DEFAULT '',
       kind TEXT NOT NULL DEFAULT 'user',
       owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
       is_public BOOLEAN NOT NULL DEFAULT TRUE,
       position INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
    `CREATE TABLE IF NOT EXISTS collection_items (
       collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
       work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
       position INTEGER NOT NULL DEFAULT 0,
       added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       PRIMARY KEY (collection_id, work_id)
     )`,
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
  // Профиль читателя: настройки, журнал чтения, достижения.
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS user_profile (
      user_id BIGINT PRIMARY KEY,
      bio TEXT,
      cover_url TEXT,
      public_profile BOOLEAN NOT NULL DEFAULT TRUE,
      show_history BOOLEAN NOT NULL DEFAULT TRUE,
      show_library BOOLEAN NOT NULL DEFAULT TRUE,
      show_bookmarks BOOLEAN NOT NULL DEFAULT TRUE,
      show_achievements BOOLEAN NOT NULL DEFAULT TRUE,
      show_genres BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS reading_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      work_id BIGINT NOT NULL,
      chapter_id BIGINT,
      event_type TEXT NOT NULL DEFAULT 'opened',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS reading_events_user_idx ON reading_events(user_id, created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS reading_events_chapter_idx ON reading_events(user_id, chapter_id)');
    await db.query(`CREATE TABLE IF NOT EXISTS achievement_definitions (
      key TEXT PRIMARY KEY,
      title_sr TEXT NOT NULL, title_ru TEXT NOT NULL, title_en TEXT NOT NULL,
      desc_sr TEXT NOT NULL, desc_ru TEXT NOT NULL, desc_en TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '★',
      category TEXT NOT NULL DEFAULT 'reading',
      threshold INTEGER NOT NULL DEFAULT 1,
      enabled BOOLEAN NOT NULL DEFAULT TRUE
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS user_achievements (
      user_id BIGINT NOT NULL,
      achievement_key TEXT NOT NULL,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      progress INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, achievement_key)
    )`);
    const seed = [
      ['first_read','Prvo čitanje','Первое чтение','First read','Otvorena prva glava.','Открыта первая глава.','Opened the first chapter.','📖','reading',1],
      ['chapters_10','10 glava','10 глав','10 chapters','Pročitano 10 glava.','Прочитано 10 глав.','Read 10 chapters.','📚','reading',10],
      ['chapters_50','50 glava','50 глав','50 chapters','Pročitano 50 glava.','Прочитано 50 глав.','Read 50 chapters.','📚','reading',50],
      ['chapters_100','100 glava','100 глав','100 chapters','Pročitano 100 glava.','Прочитано 100 глав.','Read 100 chapters.','🏆','reading',100],
      ['first_bookmark','Prva zabeleška','Первая закладка','First bookmark','Sačuvana prva zabeleška.','Сохранена первая закладка.','Saved the first bookmark.','🔖','social',1],
      ['library_first','Prvo delo u biblioteci','Первое произведение в библиотеке','First work in library','Delo je dodato u biblioteku.','Произведение добавлено в библиотеку.','Added a work to the library.','📌','social',1],
      ['first_completed','Prvo završeno delo','Первое завершённое произведение','First completed work','Delo je označeno kao završeno.','Произведение отмечено завершённым.','Marked a work as completed.','✅','reading',1],
    ];
    for (const row of seed) {
      await db.query(
        'INSERT INTO achievement_definitions (key,title_sr,title_ru,title_en,desc_sr,desc_ru,desc_en,icon,category,threshold) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (key) DO NOTHING',
        row,
      );
    }
  } catch (e: any) {
    migrationFailures.push({ name: 'reader_profile', error: String(e?.message || e) });
  }

  // Топы по периодам: история просмотров.
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS work_views (
      id BIGSERIAL PRIMARY KEY,
      work_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS work_views_work_idx ON work_views(work_id, created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS work_views_created_idx ON work_views(created_at)');
  } catch (e: any) {
    migrationFailures.push({ name: 'work_views', error: String(e?.message || e) });
  }

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
  // Non-commercial fanfiction/public-domain works: stop future sales, preserve donation records and paid entitlements.
  try { await db.query("UPDATE chapters SET access = 'free', price_cents = 0 WHERE work_id IN (SELECT id FROM works WHERE kind = 'fanfic' OR is_classic = TRUE) AND access = 'paid'"); } catch {}
  try { await db.query("UPDATE chapter_prices SET active = FALSE WHERE chapter_id IN (SELECT c.id FROM chapters c JOIN works w ON w.id = c.work_id WHERE w.kind = 'fanfic' OR w.is_classic = TRUE)"); } catch {}
  try { await db.query("UPDATE book_prices SET active = FALSE WHERE work_id IN (SELECT id FROM works WHERE kind = 'fanfic' OR is_classic = TRUE)"); } catch {}
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
