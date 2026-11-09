-- Reader Platform — схема БД (PostgreSQL 15+)
-- v0.1 · 9 ноября 2026

-- === Пользователи ===
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT,                          -- NULL, если вход только через OAuth
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'reader'
                  CHECK (role IN ('reader','author','translator','moderator','admin')),
  locale          TEXT NOT NULL DEFAULT 'sr' CHECK (locale IN ('sr','en','ru')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  storage_used    BIGINT NOT NULL DEFAULT 0,     -- байты
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ
);

CREATE TABLE oauth_accounts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('google','discord')),
  provider_uid TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_uid)
);

CREATE TABLE refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);

-- === Каталог ===
CREATE TABLE works (
  id                BIGSERIAL PRIMARY KEY,
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
  rating_avg        NUMERIC(3,2) NOT NULL DEFAULT 0,
  views_total       BIGINT NOT NULL DEFAULT 0,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX works_published_idx ON works(status, published_at DESC);
CREATE INDEX works_author_idx ON works(author_id);
CREATE INDEX works_type_idx ON works(type);

CREATE TABLE work_translations (
  work_id     BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (work_id, lang)
);

CREATE TABLE genres (
  id    SERIAL PRIMARY KEY,
  slug  TEXT UNIQUE NOT NULL,
  name_sr TEXT NOT NULL, name_en TEXT NOT NULL, name_ru TEXT NOT NULL
);

CREATE TABLE work_genres (
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, genre_id)
);

CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE work_tags (
  work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, tag_id)
);

CREATE TABLE volumes (
  id      BIGSERIAL PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number  INTEGER NOT NULL,
  title   TEXT NOT NULL DEFAULT '',
  UNIQUE (work_id, number)
);

-- === Главы ===
CREATE TABLE chapters (
  id           BIGSERIAL PRIMARY KEY,
  work_id      BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  volume_id    BIGINT REFERENCES volumes(id) ON DELETE SET NULL,
  number       INTEGER NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL DEFAULT '',          -- Markdown/HTML для novel
  word_count   INTEGER NOT NULL DEFAULT 0,
  access       TEXT NOT NULL DEFAULT 'free' CHECK (access IN ('free','subscribers','paid')),
  price_cents  INTEGER NOT NULL DEFAULT 0,        -- для access='paid'
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, number)
);
CREATE INDEX chapters_work_idx ON chapters(work_id, number);

-- страницы комиксов (этап 5)
CREATE TABLE chapter_pages (
  id         BIGSERIAL PRIMARY KEY,
  chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_no    INTEGER NOT NULL,
  file_path  TEXT NOT NULL,
  width      INTEGER, height INTEGER, bytes INTEGER,
  UNIQUE (chapter_id, page_no)
);

-- переводы глав (этап 6)
CREATE TABLE chapter_translations (
  id          BIGSERIAL PRIMARY KEY,
  chapter_id  BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL,                      -- sha256 исходника + версия промпта
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, lang, source_hash)
);
CREATE INDEX chapter_tr_lang_idx ON chapter_translations(lang, status);

CREATE TABLE glossary_terms (
  id       BIGSERIAL PRIMARY KEY,
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  lang     TEXT NOT NULL CHECK (lang IN ('sr','en','ru')),
  term     TEXT NOT NULL,
  translation TEXT NOT NULL,
  note     TEXT,
  UNIQUE (work_id, lang, term)
);

-- === Пользовательские данные ===
CREATE TABLE library_items (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE reading_progress (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id BIGINT REFERENCES chapters(id) ON DELETE SET NULL,
  position   INTEGER NOT NULL DEFAULT 0,          -- смещение/абзац
  percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE bookmarks (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id  BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  value    SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE TABLE comments (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id BIGINT REFERENCES chapters(id) ON DELETE CASCADE,
  parent_id  BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_work_idx ON comments(work_id, created_at DESC);

-- === Подписки и платежи ===
CREATE TABLE plans (
  code         TEXT PRIMARY KEY,                   -- free | reader | reader_plus
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  period       TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year','none')),
  storage_bytes BIGINT NOT NULL DEFAULT 1073741824,
  no_ads       BOOLEAN NOT NULL DEFAULT FALSE,
  early_access BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subscriptions (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code           TEXT NOT NULL REFERENCES plans(code),
  status              TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions(user_id, status);

CREATE TABLE entitlements (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('chapter','work')),
  target_id   BIGINT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('subscription','purchase','grant')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE payments (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  method       TEXT NOT NULL CHECK (method IN ('manual','card','transfer')),
  external_id  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);

-- === Реклама ===
CREATE TABLE ad_slots (
  code        TEXT PRIMARY KEY,                    -- catalog_bottom | chapter_between | chapter_end
  title       TEXT NOT NULL,
  html        TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT FALSE,
  countries   TEXT[] NOT NULL DEFAULT '{}',
  min_age_safe BOOLEAN NOT NULL DEFAULT TRUE       -- false → не показывать в 18+ разделах
);

-- === Хранилище ===
CREATE TABLE storage_files (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path        TEXT NOT NULL UNIQUE,                -- ключ в S3
  bytes       BIGINT NOT NULL,
  mime        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('scan','book','cover','page','other')),
  entity_type TEXT, entity_id BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX storage_user_idx ON storage_files(user_id);

-- === Аудит ===
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT, entity_id BIGINT,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log(created_at DESC);

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
