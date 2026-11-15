-- Reader Platform — схема БД (PostgreSQL 15+)
-- v0.1 · 9 ноября 2026

-- === Пользователи ===
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT,                          -- NULL, если вход только через OAuth
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'reader'
                  CHECK (role IN ('reader','author','translator','moderator','admin')),
  locale          TEXT NOT NULL DEFAULT 'sr' CHECK (locale IN ('sr','en','ru')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  storage_used    BIGINT NOT NULL DEFAULT 0,     -- байты
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

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

-- === Издательства ===
CREATE TABLE IF NOT EXISTS publishers (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  contact_email  TEXT NOT NULL DEFAULT '',
  commission_pct SMALLINT NOT NULL DEFAULT 50 CHECK (commission_pct BETWEEN 0 AND 100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publisher_members (
  publisher_id BIGINT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','manager','member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, user_id)
);
CREATE INDEX IF NOT EXISTS publisher_members_user_idx ON publisher_members(user_id);

-- === Каталог ===
CREATE TABLE works (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  author_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  publisher_id      BIGINT REFERENCES publishers(id) ON DELETE SET NULL,
  type              TEXT NOT NULL DEFAULT 'novel' CHECK (type IN ('novel','comic')),
  original_language TEXT NOT NULL CHECK (original_language IN ('sr','en','ru')),
  kind              TEXT NOT NULL DEFAULT 'original' CHECK (kind IN ('original','fanfic')),
  exclusivity       BOOLEAN NOT NULL DEFAULT FALSE,   -- эксклюзив автора → 80%
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','review','published','hidden')),
  completion        TEXT NOT NULL DEFAULT 'ongoing' CHECK (completion IN ('ongoing','completed','hiatus')),
  age_rating        SMALLINT NOT NULL DEFAULT 0 CHECK (age_rating IN (0,16,18)),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  -- Нормализованный ключ поиска (lib/translit.ts): «Андрић» = «Andric» = «Andrić».
  search_norm       TEXT NOT NULL DEFAULT '',
  is_classic        BOOLEAN NOT NULL DEFAULT FALSE,   -- классика (public domain)
  -- NULL = по умолчанию: самиздат/классика — можно, издательские — нельзя.
  translit_allowed  BOOLEAN,
  -- NULL = по умолчанию: самиздат и фанфики — можно, издательские и классика — нет.
  paragraph_comments_enabled BOOLEAN,
  cover_path        TEXT,
  font_family       TEXT,
  font_path         TEXT,
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

-- Комментарии к абзацам (ТЗ 4.6, 5.4): только для самиздата и фанфиков.
CREATE TABLE IF NOT EXISTS paragraph_comments (
  id              BIGSERIAL PRIMARY KEY,
  chapter_id      BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL CHECK (paragraph_index >= 0),
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  hidden          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paragraph_comments_chapter_idx ON paragraph_comments(chapter_id, paragraph_index);

-- Удаление аккаунта в 2 шага (ТЗ 7.6): запрос → подтверждение по токену.
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_deletion_user_idx ON account_deletion_requests(user_id, used_at);

-- === Подписки и платежи ===
CREATE TABLE plans (
  code         TEXT PRIMARY KEY,                   -- free | reader | reader_plus
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'RSD',
  period       TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year','none')),
  max_profiles SMALLINT NOT NULL DEFAULT 1,
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
  auto_renew           BOOLEAN NOT NULL DEFAULT TRUE,
  canceled_at          TIMESTAMPTZ,
  reminder_sent_at     TIMESTAMPTZ,
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
  currency     TEXT NOT NULL DEFAULT 'RSD',
  method       TEXT NOT NULL CHECK (method IN ('manual','card','transfer')),
  external_id  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);

-- === Покупки книг и глав (Фаза 1) ===
CREATE TABLE IF NOT EXISTS book_prices (
  work_id      BIGINT NOT NULL UNIQUE REFERENCES works(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency     TEXT NOT NULL DEFAULT 'RSD',
  active       SMALLINT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id      BIGINT REFERENCES works(id) ON DELETE CASCADE,
  chapter_id   BIGINT REFERENCES chapters(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  coins        INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  currency     TEXT NOT NULL DEFAULT 'RSD',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  provider     TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','stripe')),
  external_id  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ,
  CHECK (work_id IS NOT NULL OR chapter_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases(user_id, status);
CREATE INDEX IF NOT EXISTS purchases_work_idx ON purchases(work_id, status);
CREATE INDEX IF NOT EXISTS purchases_chapter_idx ON purchases(chapter_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_unique_active
  ON purchases (user_id, COALESCE(work_id, 0), COALESCE(chapter_id, 0))
  WHERE status IN ('pending','paid');

CREATE TABLE IF NOT EXISTS royalty_ledger (
  id               BIGSERIAL PRIMARY KEY,
  publisher_id     BIGINT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  work_id          BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  purchase_id      BIGINT NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE CASCADE,
  amount_cents     INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','paid')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS royalty_publisher_idx ON royalty_ledger(publisher_id, status);
CREATE INDEX IF NOT EXISTS royalty_work_idx ON royalty_ledger(work_id);

CREATE TABLE IF NOT EXISTS payouts (
  id           BIGSERIAL PRIMARY KEY,
  publisher_id BIGINT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payouts_publisher_idx ON payouts(publisher_id, status);

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

INSERT INTO genres (slug, name_sr, name_en, name_ru) VALUES
  ('fantasy','Fantastika','Fantasy','Фэнтези'),
  ('romance','Romantika','Romance','Романтика'),
  ('scifi','Naučna fantastika','Sci-Fi','Фантастика'),
  ('mystery','Misterija','Mystery','Детектив'),
  ('drama','Drama','Drama','Драма'),
  ('adventure','Avantura','Adventure','Приключения'),
  ('horror','Horor','Horror','Хоррор'),
  ('comedy','Komedija','Comedy','Комедия'),
  ('historical','Istorijski','Historical','Исторический'),
  ('slice','Slica života','Slice of life','Слайс оф лайф')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Фаза 2–4: донаты, цены глав, лиды издательств, устройства ===

CREATE TABLE IF NOT EXISTS chapter_prices (
  chapter_id   BIGINT NOT NULL UNIQUE REFERENCES chapters(id) ON DELETE CASCADE,
  coins        INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),  -- цена главы в монетах (1 монета = 1 RSD)
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency     TEXT NOT NULL DEFAULT 'RSD',
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donations (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id      BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  chapter_id   BIGINT REFERENCES chapters(id) ON DELETE SET NULL,
  author_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 100 AND 100000),
  fee_cents    INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  author_cents INTEGER NOT NULL DEFAULT 0 CHECK (author_cents >= 0),
  currency     TEXT NOT NULL DEFAULT 'RSD',
  message      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  provider     TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','stripe')),
  external_id  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS donations_work_idx ON donations(work_id, created_at DESC);
CREATE INDEX IF NOT EXISTS donations_author_idx ON donations(author_id, status);
CREATE INDEX IF NOT EXISTS donations_user_idx ON donations(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS donations_external_idx ON donations(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS author_payouts (
  id           BIGSERIAL PRIMARY KEY,
  author_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency     TEXT NOT NULL DEFAULT 'RSD',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS author_payouts_author_idx ON author_payouts(author_id, status);

CREATE TABLE IF NOT EXISTS publisher_leads (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  company    TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publisher_leads_created_idx ON publisher_leads(created_at DESC);

CREATE TABLE IF NOT EXISTS content_devices (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash   TEXT NOT NULL,
  user_agent    TEXT NOT NULL DEFAULT '',
  ip_hash       TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);
CREATE INDEX IF NOT EXISTS content_devices_user_idx ON content_devices(user_id, last_seen_at DESC);

-- === Экономика v0.2: монеты (1 монета = 1 RSD), RSD, семейные профили, согласия ===

CREATE TABLE IF NOT EXISTS wallets (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_coins BIGINT NOT NULL DEFAULT 0 CHECK (balance_coins >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL CHECK (delta <> 0),
  kind          TEXT NOT NULL CHECK (kind IN ('topup','spend','refund','bonus')),
  ref_id        TEXT,
  balance_after BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_tx_user_idx ON coin_transactions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION coin_tx_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'coin_transactions is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS coin_tx_immutable_update ON coin_transactions;
CREATE TRIGGER coin_tx_immutable_update BEFORE UPDATE ON coin_transactions
  FOR EACH ROW EXECUTE FUNCTION coin_tx_immutable();
DROP TRIGGER IF EXISTS coin_tx_immutable_delete ON coin_transactions;
CREATE TRIGGER coin_tx_immutable_delete BEFORE DELETE ON coin_transactions
  FOR EACH ROW EXECUTE FUNCTION coin_tx_immutable();

CREATE TABLE IF NOT EXISTS coin_packages (
  code        TEXT PRIMARY KEY,
  coins       INTEGER NOT NULL CHECK (coins > 0),
  price_rsd   INTEGER NOT NULL CHECK (price_rsd > 0),
  bonus_coins INTEGER NOT NULL DEFAULT 0 CHECK (bonus_coins >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO coin_packages (code, coins, price_rsd, bonus_coins, active) VALUES
  ('coins_200',  200,  200,  0, TRUE),
  ('coins_500',  500,  500,  0, TRUE),
  ('coins_1000', 1000, 1000, 0, TRUE),
  ('coins_2000', 2000, 2000, 0, TRUE)
ON CONFLICT (code) DO UPDATE SET
  coins = excluded.coins, price_rsd = excluded.price_rsd,
  bonus_coins = excluded.bonus_coins, active = excluded.active;

CREATE TABLE IF NOT EXISTS coin_orders (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_code TEXT NOT NULL REFERENCES coin_packages(code),
  coins        INTEGER NOT NULL,
  price_rsd    INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled')),
  provider     TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','stripe')),
  external_id  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS coin_orders_user_idx ON coin_orders(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS coin_orders_external_idx ON coin_orders(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_economy_settings (
  user_id                  BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto_unlock              BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_spend_limit_coins INTEGER NOT NULL DEFAULT 0 CHECK (monthly_spend_limit_coins >= 0),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consents (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('paid_chapter_refusal_right','terms')),
  work_id      BIGINT, chapter_id BIGINT,
  text_version TEXT NOT NULL DEFAULT 'v0.2',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consents_user_idx ON consents(user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS family_members (
  owner_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, member_user_id)
);
CREATE INDEX IF NOT EXISTS family_owner_idx ON family_members(owner_user_id);

CREATE TABLE IF NOT EXISTS author_earnings (
  id               BIGSERIAL PRIMARY KEY,
  author_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id          BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source           TEXT NOT NULL CHECK (source IN ('book','chapter','donation')),
  purchase_id      BIGINT REFERENCES purchases(id) ON DELETE CASCADE,
  donation_id      BIGINT REFERENCES donations(id) ON DELETE CASCADE,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents >= 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  author_cents     INTEGER NOT NULL CHECK (author_cents >= 0),
  currency         TEXT NOT NULL DEFAULT 'RSD',
  status           TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','paid')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS author_earnings_purchase_idx
  ON author_earnings(purchase_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS author_earnings_author_idx ON author_earnings(author_id, status);

-- Новые тарифы (решения §10): 699 / 6 990 / 1 199 RSD, семейный — до 5 профилей.
INSERT INTO plans (code, name, price_cents, currency, period, storage_bytes, no_ads, early_access, active) VALUES
  ('month',  'Mesečna pretplata', 69900, 'RSD', 'month', 5368709120, TRUE, FALSE, TRUE),
  ('year',   'Godišnja pretplata', 699000, 'RSD', 'year', 21474836480, TRUE, TRUE, TRUE),
  ('family', 'Porodična pretplata', 119900, 'RSD', 'month', 21474836480, TRUE, FALSE, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = excluded.name, price_cents = excluded.price_cents, currency = excluded.currency,
  period = excluded.period, active = TRUE;
