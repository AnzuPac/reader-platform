#!/usr/bin/env node
/**
 * Демо-данные для показа читалки. Идемпотентен: повторный запуск не плодит дубли.
 *   node scripts/seed-demo.mjs
 * SQLite по умолчанию (data/reader.db), PostgreSQL при DATABASE_URL.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const root = process.cwd();
const PASSWORD = 'demo1234';
// Экономика v0.2: 1 монета = 1 RSD, книга 990 RSD, глава 15 монет, подписка 699 RSD.
const BOOK_PRICE_RSD = 990;
const CHAPTER_COINS = 15;
const BOOK_PRICE_CENTS = BOOK_PRICE_RSD * 100;
const CHAPTER_PRICE_CENTS = CHAPTER_COINS * 100;
const ENV = process.env.DATABASE_URL ? 'pg' : 'sqlite';
let db;
let pg;

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function q(sql, params = []) {
  if (ENV === 'pg') {
    const r = await pg.query(toPg(sql), params);
    return r.rows;
  }
  return db.prepare(sql).all(...params);
}

async function exec(sql) {
  if (ENV === 'pg') await pg.query(sql);
  else db.exec(sql);
}

async function init() {
  const schemaFile = ENV === 'pg' ? 'db/schema.sql' : 'db/schema.sqlite.sql';
  const schema = readFileSync(path.join(root, schemaFile), 'utf8');
  if (ENV === 'pg') {
    const { Pool } = await import('pg');
    pg = new Pool({ connectionString: process.env.DATABASE_URL });
    await pg.query(schema);
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const dir = process.env.SQLITE_DIR || path.join(root, 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, 'reader.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(schema);
    for (const sql of [
      'ALTER TABLE works ADD COLUMN font_family TEXT',
      'ALTER TABLE works ADD COLUMN font_path TEXT',
      'ALTER TABLE works ADD COLUMN publisher_id INTEGER REFERENCES publishers(id)',
      'ALTER TABLE works ADD COLUMN kind TEXT NOT NULL DEFAULT \'original\'',
      'ALTER TABLE works ADD COLUMN exclusivity INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE chapter_prices ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN coins INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE plans ADD COLUMN max_profiles SMALLINT NOT NULL DEFAULT 1',
    ]) { try { db.exec(sql); } catch {} }
  }

  // v0.2: старые тарифы выключаем, семейный — 5 профилей (после схемы).
  try { await exec("UPDATE plans SET active = 0 WHERE code IN ('free','reader','reader_plus')"); } catch {}
  try { await exec("UPDATE plans SET max_profiles = 5 WHERE code = 'family'"); } catch {}
}

const hash = bcrypt.hashSync(PASSWORD, 10);

async function upsertUser(email, displayName, role) {
  const rows = await q(
    `INSERT INTO users (email, password_hash, display_name, role, locale, email_verified)
     VALUES (?,?,?,?,'sr',1)
     ON CONFLICT(email) DO UPDATE SET
       password_hash = excluded.password_hash,
       display_name = excluded.display_name,
       role = excluded.role,
       email_verified = 1
     RETURNING id`,
    [email, hash, displayName, role]
  );
  return rows[0].id;
}

async function upsertPublisher(name, slug, email, pct) {
  const rows = await q(
    `INSERT INTO publishers (name, slug, contact_email, commission_pct)
     VALUES (?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       contact_email = excluded.contact_email,
       commission_pct = excluded.commission_pct
     RETURNING id`,
    [name, slug, email, pct]
  );
  return rows[0].id;
}

async function upsertWork(w) {
  const rows = await q(
    `INSERT INTO works (slug, author_id, publisher_id, type, kind, original_language, status, completion,
                        age_rating, title, description, words_total, published_at)
     VALUES (?,?,?,?,?,'sr','published','ongoing',?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(slug) DO UPDATE SET
       author_id = excluded.author_id,
       publisher_id = excluded.publisher_id,
       type = excluded.type,
       kind = excluded.kind,
       status = 'published',
       title = excluded.title,
       description = excluded.description,
       words_total = excluded.words_total,
       published_at = COALESCE(works.published_at, CURRENT_TIMESTAMP)
     RETURNING id`,
    [w.slug, w.authorId, w.publisherId ?? null, w.type, w.kind ?? 'original', w.age, w.title, w.description, w.words]
  );
  return rows[0].id;
}

async function upsertChapter(workId, number, title, content, access) {
  const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const rows = await q(
    `INSERT INTO chapters (work_id, number, title, content, word_count, access, price_cents, status, published_at)
     VALUES (?,?,?,?,?,?,0,'published',CURRENT_TIMESTAMP)
     ON CONFLICT(work_id, number) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       word_count = excluded.word_count,
       access = excluded.access,
       status = 'published',
       published_at = COALESCE(chapters.published_at, CURRENT_TIMESTAMP)
     RETURNING id`,
    [workId, number, title, content, words, access]
  );
  return rows[0].id;
}

function comicPage(n, title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1300" viewBox="0 0 900 1300">
  <rect width="900" height="1300" fill="#14101f"/>
  <rect x="40" y="40" width="820" height="1220" fill="#1e1830" stroke="#a78bfa" stroke-width="4"/>
  <circle cx="720" cy="200" r="110" fill="#e04b4b" opacity="0.85"/>
  <text x="80" y="140" fill="#a78bfa" font-family="Georgia,serif" font-size="44">${title}</text>
  <text x="80" y="210" fill="#c9c3dd" font-family="Georgia,serif" font-size="28">Strana ${n}</text>
  <path d="M80 1000 L300 680 L470 900 L640 620 L820 1000" fill="none" stroke="#7c5cff" stroke-width="8"/>
  <text x="80" y="1180" fill="#8d86a8" font-family="Georgia,serif" font-size="24">Demo strip · Krvavi mesec</text>
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

async function ensurePurchase(userId, workId, chapterId, amount) {
  const where = chapterId
    ? 'user_id = ? AND chapter_id = ? AND status = ?'
    : 'user_id = ? AND work_id = ? AND status = ?';
  const rows = await q(`SELECT id FROM purchases WHERE ${where} LIMIT 1`,
    chapterId ? [userId, chapterId, 'paid'] : [userId, workId, 'paid']);
  if (rows.length) return rows[0].id;
  const coins = Math.round(amount / 100);
  const ins = await q(
    `INSERT INTO purchases (user_id, work_id, chapter_id, amount_cents, coins, currency, status, provider, paid_at)
     VALUES (?,?,?,?,?,'RSD','paid','manual',CURRENT_TIMESTAMP) RETURNING id`,
    [userId, workId, chapterId, amount, coins]
  );
  return ins[0].id;
}

async function ensureRoyalty(publisherId, workId, purchaseId, amount, pct) {
  const commission = Math.floor((amount * pct + 50) / 100);
  await q(
    `INSERT INTO royalty_ledger (publisher_id, work_id, purchase_id, amount_cents, commission_cents)
     VALUES (?,?,?,?,?)
     ON CONFLICT(purchase_id) DO NOTHING`,
    [publisherId, workId, purchaseId, amount, commission]
  );
}

async function ensureDonation(userId, workId, authorId, amount, message, ext) {
  const existing = await q('SELECT id FROM donations WHERE external_id = ?', [ext]);
  if (existing.length) return existing[0].id;
  // Донаты: 0% комиссии и для фанфика, и для оригинала по умолчанию.
  const fee = 0;
  const rows = await q(
    `INSERT INTO donations (user_id, work_id, author_id, amount_cents, fee_cents, author_cents,
                            currency, message, status, provider, external_id, paid_at)
     VALUES (?,?,?,?,?,?,'RSD',?,'paid','manual',?,CURRENT_TIMESTAMP) RETURNING id`,
    [userId, workId, authorId, amount, fee, amount - fee, message, ext]
  );
  return rows[0].id;
}

/** Кошелёк демо-читателя: 500 монет и запись в неизменяемом журнале. */
async function ensureWallet(userId, coins, refId) {
  await q(
    `INSERT INTO wallets (user_id, balance_coins) VALUES (?,?)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId, coins]
  );
  const existing = await q('SELECT id FROM coin_transactions WHERE ref_id = ?', [refId]);
  if (existing.length) return;
  await q(
    `INSERT INTO coin_transactions (user_id, delta, kind, ref_id, balance_after)
     VALUES (?,?,'bonus',?,?)`,
    [userId, coins, refId, coins]
  );
}

/** Ставка автора: 70% обычная, 80% при эксклюзиве. */
async function ensureAuthorEarning(authorId, workId, purchaseId, amount, pct) {
  const commission = Math.floor((amount * (100 - pct) + 50) / 100);
  await q(
    `INSERT INTO author_earnings
       (author_id, work_id, source, purchase_id, amount_cents, commission_cents, author_cents, currency, status)
     VALUES (?,?, 'chapter', ?, ?, ?, ?, 'RSD', 'accrued')
     ON CONFLICT DO NOTHING`,
    [authorId, workId, purchaseId, amount, commission, amount - commission]
  );
}

/** Потолок P3: сумма цен глав ≤ цена книги. */
async function setChapterCoins(chapterId, coins) {
  await q(
    `INSERT INTO chapter_prices (chapter_id, coins, amount_cents, currency, active)
     VALUES (?,?,?,'RSD',1)
     ON CONFLICT(chapter_id) DO UPDATE SET
       coins = excluded.coins, amount_cents = excluded.amount_cents,
       currency = 'RSD', active = 1`,
    [chapterId, coins, coins * 100]
  );
  await q('UPDATE chapters SET price_cents = ? WHERE id = ?', [coins * 100, chapterId]);
}

async function main() {
  await init();

  const readerId = await upsertUser('demo.reader@example.com', 'Mila Petrović', 'reader');
  const ownerId = await upsertUser('demo.publisher@example.com', 'Nikola Jovanović', 'reader');
  const authorId = await upsertUser('demo.author@example.com', 'Ana Stanković', 'author');
  // Демо-админ для показа /admin/publishers (ADMIN_TOKEN остаётся отдельным ключом).
  const adminId = await upsertUser('demo.admin@example.com', 'Demo Admin', 'admin');
  // Чистый аккаунт без покупок — для живой демонстрации оплаты на сцене.
  await upsertUser('demo.buyer@example.com', 'Demo Kupac', 'reader');

  // Комиссия платформы по ТЗ — 50% издательской книги.
  const publisherId = await upsertPublisher('Demo Izdavaštvo', 'demo-izdavastvo', 'demo.publisher@example.com', 50);
  await q(
    `INSERT INTO publisher_members (publisher_id, user_id, role) VALUES (?,?,'owner')
     ON CONFLICT(publisher_id, user_id) DO UPDATE SET role = 'owner'`,
    [publisherId, ownerId]
  );

  const chapterText = (n) => `# Glava ${n}\n\nBeograd je te noći disao tiše nego obično. Kiša je prala kaldrmu Skadarlije, a senke su se skupljale uz zidove kao da čuvaju neku staru tajnu.\n\nMila je zatvorila kišobran i oslušnula. Negde između dva dvorišta začuo se korak — previše pravilan za pijanog prolaznika, previše tih za noćnog čuvara.\n\n„Ako si došao po priču“, rekla je, „ostavi je na stolu. Ako si došao po mene, zakasnio si sedam godina.“\n\nSvetlost fenjera prešla je preko lica nepoznatog čoveka. U ruci je držao kovertu bez imena, a na njoj je bio samo jedan pečat — zvezda sa sedam krakova.\n\nOno što je bilo unutra promenilo je sve što je Mila znala o gradu, o svojoj porodici i o noći kada je nestao njen brat.`;

  const bookId = await upsertWork({
    slug: 'senke-starog-grada', authorId, publisherId, type: 'novel', kind: 'original', age: 16,
    title: 'Senke starog grada',
    description: 'Misterija iz starog Beograda: pismo bez imena, pečat sa sedam krakova i nestanak koji porodica nikada nije prebolela.',
    words: 4200,
  });
  await q(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES (?,?,'RSD',1)
     ON CONFLICT(work_id) DO UPDATE SET amount_cents = excluded.amount_cents, currency = 'RSD', active = 1`,
    [bookId, BOOK_PRICE_CENTS]
  );
  const bookCh1 = await upsertChapter(bookId, 1, 'Pismo bez imena', chapterText(1), 'free');
  const bookCh2 = await upsertChapter(bookId, 2, 'Pečat sa sedam krakova', chapterText(2), 'paid');
  const bookCh3 = await upsertChapter(bookId, 3, 'Noć kada je grad ćutao', chapterText(3), 'paid');
  for (const chId of [bookCh2, bookCh3]) await setChapterCoins(chId, CHAPTER_COINS);

  const comicId = await upsertWork({
    slug: 'krvavi-mesec', authorId, publisherId: null, type: 'comic', kind: 'original', age: 18,
    title: 'Krvavi mesec',
    description: 'Noir strip o gradu, krvi i mesecu koji nikada ne zalazi. Tri glave, prva besplatna.',
    words: 0,
  });
  const comicCh1 = await upsertChapter(comicId, 1, 'Prva noć', '', 'free');
  const comicCh2 = await upsertChapter(comicId, 2, 'Crveni trag', '', 'paid');
  const comicCh3 = await upsertChapter(comicId, 3, 'Mesec iznad grada', '', 'paid');
  // Цена книги-комикса = 1 000 RSD, потолок глав — 1 000 монет.
  await q(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES (?,100000,'RSD',1)
     ON CONFLICT(work_id) DO UPDATE SET amount_cents = 100000, currency = 'RSD', active = 1`,
    [comicId]
  );
  for (const [chId, n] of [[comicCh1, 1], [comicCh2, 2], [comicCh3, 3]]) {
    if (n > 1) await setChapterCoins(chId, CHAPTER_COINS);
    for (let p = 1; p <= 3; p++) {
      await q(
        `INSERT INTO chapter_pages (chapter_id, page_no, file_path, width, height)
         VALUES (?,?,?,900,1300)
         ON CONFLICT(chapter_id, page_no) DO UPDATE SET file_path = excluded.file_path`,
        [chId, p, comicPage(p, `Glava ${n}`)]
      );
    }
  }

  const fanficId = await upsertWork({
    slug: 'nocna-straza', authorId, publisherId: null, type: 'novel', kind: 'fanfic', age: 0,
    title: 'Noćna straža',
    description: 'Fanfiction: posle smene, čuvar gradske biblioteke otkriva da knjige menjaju mesta — i da ga neko čita dok spava.',
    words: 2600,
  });
  await upsertChapter(fanficId, 1, 'Prva smena', chapterText(1), 'free');
  await upsertChapter(fanficId, 2, 'Ko čita dok spavaš', chapterText(2), 'free');

  // Две оплаченные покупки демо-читателя: книга целиком и глава комикса.
  const bookPurchase = await ensurePurchase(readerId, bookId, null, BOOK_PRICE_CENTS);
  await ensureRoyalty(publisherId, bookId, bookPurchase, BOOK_PRICE_CENTS, 50);
  // Глава комикса: продаётся напрямую автору (70%), издательства у комикса нет.
  const comicPurchase = await ensurePurchase(readerId, comicId, comicCh2, CHAPTER_PRICE_CENTS);
  await ensureAuthorEarning(authorId, comicId, comicPurchase, CHAPTER_PRICE_CENTS, 70);

  // Кошелёк читателя: 500 монет бонусом (демо).
  await ensureWallet(readerId, 500, 'seed-demo-wallet-bonus');

  // Три доната автору фанфика: 0% комиссии.
  await ensureDonation(readerId, fanficId, authorId, 50000, 'Hvala za priču! Jedva čekam nastavak.', 'seed-demo-donation-1');
  await ensureDonation(readerId, fanficId, authorId, 100000, 'Noćna straža mi je ulepšala nedelju.', 'seed-demo-donation-2');
  await ensureDonation(readerId, fanficId, authorId, 30000, 'Podrška za sledeću glavu 🙌', 'seed-demo-donation-3');

  // Одна заявка издательства.
  const lead = await q('SELECT id FROM publisher_leads WHERE email = ? AND company = ?', [
    'kontakt@demo-izdavastvo.rs', 'Demo Izdavaštvo',
  ]);
  if (!lead.length) {
    await q(
      `INSERT INTO publisher_leads (name, company, email, phone, message, status)
       VALUES (?,?,?,?,?,'new')`,
      ['Jelena Marković', 'Demo Izdavaštvo', 'kontakt@demo-izdavastvo.rs', '+381 60 123 4567',
        'Zainteresovani smo za pilot sa 3 naslova i prodaju po knjizi.']
    );
  }

  const bookSlug = 'senke-starog-grada';
  const fanficSlug = 'nocna-straza';
  console.log('\n=== DEMO PODACI SPREMNI ===');
  console.table([
    { uloga: 'Čitalac', login: 'demo.reader@example.com', lozinka: PASSWORD, 'šta gledati': 'novčanik (500), kupovina knjige, biblioteka, donacija' },
    { uloga: 'Izdavač (vlasnik)', login: 'demo.publisher@example.com', lozinka: PASSWORD, 'šta gledati': '/sr/publisher — izveštaj, cene, honorari' },
    { uloga: 'Autor', login: 'demo.author@example.com', lozinka: PASSWORD, 'šta gledati': '/sr/author — dela, donacije, isplate' },
    { uloga: 'Admin (stranica)', login: 'demo.admin@example.com', lozinka: PASSWORD, 'šta gledati': '/sr/admin/publishers' },
    { uloga: 'Novi kupac', login: 'demo.buyer@example.com', lozinka: PASSWORD, 'šta gledati': 'živa kupovina knjige bez istorije' },
  ]);
  console.log('Admin token za /admin/publishers: ADMIN_TOKEN iz .env (podrazumevano dev-admin-token)\n');
  console.log('Linkovi za proveru:');
  console.log(`  /sr/work/${bookSlug}`);
  console.log(`  /sr/work/${fanficSlug}`);
  console.log(`  /sr/read/${comicCh1}  (komiks, glava 1 besplatna)`);
  console.log('  /sr/catalog');
  console.log('  /sr/account  (novčanik: balans, dopuna, istorija)');
  console.log('  /sr/subscribe  (699 / 6 990 / 1 199 RSD)');
  console.log('  /sr/publisher');
  console.log('  /sr/publishers');
  console.log('  /sr/admin/publishers');

  if (pg) await pg.end();
  else if (db) db.close?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
