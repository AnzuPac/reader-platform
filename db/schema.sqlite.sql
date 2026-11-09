-- Reader Platform — схема БД (PostgreSQL 15+)
-- v0.1 · 9 ноября 2026

-- === Пользователи ===
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT,                          -- NULL, если вход только через OAuth
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'reader'
                  CHECK (role IN ('reader','author','translator','moderator','admin')),
  locale          TEXT NOT NULL DEFAULT 'sr' CHECK (locale IN ('sr','en','ru')),
  email_verified  INTEGER NOT NULL DEFAULT 0,
  storage_used    BIGINT NOT NULL DEFAULT 0,     -- байты
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('google','discord')),
  provider_uid TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

-- === Каталог ===
CREATE TABLE IF NOT EXISTS works (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT UNIQUE NOT NULL,
  author_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type              TEXT NOT NULL DEFAULT 'novel' CHECK (type IN ('novel','comic')),
  original_language TEXT NOT NULL CHECK (original_language IN ('sr','en','ru')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','review','published','hidden')),
  completion        TEXT NOT NULL DEFAULT 'ongoing' CHECK (completion IN ('ongoing','completed','hiatus')),
  age_rating        SMALLINT NOT NULL DEFAULT 0 CHECK (age_rating IN (0,16,18)),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  cover_path        TEXT,
  words_total       INTEGER NOT NULL DEFAULT 0,
  ratings_count     INTEGER NOT NULL DEFAULT 0,
  rating_avg        REAL NOT NULL DEFAULT 0,
  views_total       BIGINT NOT NULL DEFAULT 0,
  published_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS works_published_idx ON works(status, published_at DESC);
CREATE INDEX IF NOT EXISTS works_author_idx ON works(author_id);
CREATE INDEX IF NOT EXISTS works_type_idx ON works(type);

CREATE TABLE IF NOT EXISTS work_translations (
  work_id     BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (work_id, lang)
);

CREATE TABLE IF NOT EXISTS genres (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT UNIQUE NOT NULL,
  name_sr TEXT NOT NULL, name_en TEXT NOT NULL, name_ru TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_genres (
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, genre_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_tags (
  work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, tag_id)
);

CREATE TABLE IF NOT EXISTS volumes (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number  INTEGER NOT NULL,
  title   TEXT NOT NULL DEFAULT '',
  UNIQUE (work_id, number)
);

-- === Главы ===
CREATE TABLE IF NOT EXISTS chapters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id      BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  volume_id    BIGINT REFERENCES volumes(id) ON DELETE SET NULL,
  number       INTEGER NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL DEFAULT '',          -- Markdown/HTML для novel
  word_count   INTEGER NOT NULL DEFAULT 0,
  access       TEXT NOT NULL DEFAULT 'free' CHECK (access IN ('free','subscribers','paid')),
  price_cents  INTEGER NOT NULL DEFAULT 0,        -- для access='paid'
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (work_id, number)
);
CREATE INDEX IF NOT EXISTS chapters_work_idx ON chapters(work_id, number);

-- страницы комиксов (этап 5)
CREATE TABLE IF NOT EXISTS chapter_pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_no    INTEGER NOT NULL,
  file_path  TEXT NOT NULL,
  width      INTEGER, height INTEGER, bytes INTEGER,
  UNIQUE (chapter_id, page_no)
);

-- переводы глав (этап 6)
CREATE TABLE IF NOT EXISTS chapter_translations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id  BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL,                      -- sha256 исходника + версия промпта
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  model       TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chapter_id, lang, source_hash)
);
CREATE INDEX IF NOT EXISTS chapter_tr_lang_idx ON chapter_translations(lang, status);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  lang     TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  term     TEXT NOT NULL,
  translation TEXT NOT NULL,
  note     TEXT,
  UNIQUE (work_id, lang, term)
);

-- === Пользовательские данные ===
CREATE TABLE IF NOT EXISTS library_items (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id BIGINT REFERENCES chapters(id) ON DELETE SET NULL,
  position   INTEGER NOT NULL DEFAULT 0,          -- смещение/абзац
  percent    REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  value    SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id BIGINT REFERENCES chapters(id) ON DELETE CASCADE,
  parent_id  BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS comments_work_idx ON comments(work_id, created_at DESC);

-- === Подписки и платежи ===
CREATE TABLE IF NOT EXISTS plans (
  code         TEXT PRIMARY KEY,                   -- free | reader | reader_plus
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  period       TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year','none')),
  storage_bytes BIGINT NOT NULL DEFAULT 1073741824,
  no_ads       INTEGER NOT NULL DEFAULT 0,
  early_access INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code           TEXT NOT NULL REFERENCES plans(code),
  status              TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','expired')),
  current_period_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end   TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS entitlements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('chapter','work')),
  target_id   BIGINT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('subscription','purchase','grant')),
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  method       TEXT NOT NULL CHECK (method IN ('manual','card','transfer')),
  external_id  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  meta         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at      TEXT
);

-- === Реклама ===
CREATE TABLE IF NOT EXISTS ad_slots (
  code        TEXT PRIMARY KEY,                    -- catalog_bottom | chapter_between | chapter_end
  title       TEXT NOT NULL,
  html        TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 0,
  countries   TEXT NOT NULL DEFAULT '[]',
  min_age_safe INTEGER NOT NULL DEFAULT 1       -- false → не показывать в 18+ разделах
);

-- === Хранилище ===
CREATE TABLE IF NOT EXISTS storage_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path        TEXT NOT NULL UNIQUE,                -- ключ в S3
  bytes       BIGINT NOT NULL,
  mime        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('scan','book','cover','page','other')),
  entity_type TEXT, entity_id BIGINT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS storage_user_idx ON storage_files(user_id);

-- === Аудит ===
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT, entity_id BIGINT,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at DESC);

-- === Начальные данные ===
INSERT INTO plans (code, name, price_cents, storage_bytes, no_ads, early_access) VALUES
  ('free',        'Free',        0,    1073741824,  FALSE, FALSE),
  ('reader',      'Reader',      499,  5368709120,  TRUE,  FALSE),
  ('reader_plus', 'Reader+',     999, 21474836480,  TRUE,  TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ad_slots (code, title) VALUES
  ('catalog_bottom', 'Каталог — нижний блок'),
  ('chapter_between', 'Читалка — между главами'),
  ('chapter_end', 'Читалка — конец главы')
ON CONFLICT (code) DO NOTHING;
