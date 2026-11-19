#!/usr/bin/env node
/**
 * E2E-прогон основных сценариев по реальному HTTP.
 *
 * Поднимает собранное приложение (`next start`) на свободном порту с временной
 * SQLite-базой, проходит сценарии через fetch с настоящими cookie и гасит сервер.
 * Новых зависимостей не нужно: только Node 24 и уже собранный `.next`.
 *
 * Запуск: npm run e2e   (или node scripts/e2e.mjs)
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';

// Node-fetch уважает HTTP(S)_PROXY из окружения, curl для localhost — нет.
// Для локального прогона прокси только мешает: чистим до первых запросов.
for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
  delete process.env[key];
}
process.env.NO_PROXY = '*';
process.env.no_proxy = '*';

const PORT = 31_000 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_DIR = mkdtempSync(path.join(tmpdir(), 'reader-e2e-'));
const LANG = 'sr';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Куки в стиле браузера: сервер ставит, клиент возвращает. */
const jar = new Map();
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function absorb(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

async function api(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  absorb(res);
  return res;
}

async function waitForHealth(timeoutMs = 90_000) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
      if (res.status === 503) {
        const body = await res.text();
        throw new Error(`health 503: ${body.slice(0, 300)}`);
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      if (String(e).includes('health 503')) throw e;
      lastError = String(e).slice(0, 200);
    }
    await sleep(500);
  }
  throw new Error(`health не ответил за ${timeoutMs / 1000} c (${lastError})\n${serverLog.slice(-1500)}`);
}

/** Данные кладём прямо в живую БД: приложение и скрипт — разные процессы. */
function seed() {
  const db = new DatabaseSync(path.join(DB_DIR, 'reader.db'));
  const now = new Date().toISOString();
  // node:sqlite связывает позиционные аргументы только с "?", а не с "$1".
  const author = db.prepare(
    "INSERT INTO users (email, display_name, role) VALUES (?,?,?) RETURNING id",
  ).get('e2e-author@test', 'E2E Autor', 'author');
  const work = db.prepare(
    `INSERT INTO works (slug, author_id, original_language, status, title, description, type, kind, published_at)
     VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
  ).get('e2e-work', author.id, 'sr', 'published', 'E2E Knjiga', 'opis', 'novel', 'original', now);
  const free = db.prepare(
    `INSERT INTO chapters (work_id, number, title, content, access, status, published_at)
     VALUES (?,?,?,?,?,?,?) RETURNING id`,
  ).get(work.id, 1, 'Prva', '<p>Besplatan tekst.</p>', 'free', 'published', now);
  const paid = db.prepare(
    `INSERT INTO chapters (work_id, number, title, content, access, status, price_cents, published_at)
     VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
  ).get(work.id, 2, 'Druga', '<p>Plaćeni tekst.</p>', 'paid', 'published', 10000, now);
  db.close();
  return { authorId: Number(author.id), workId: Number(work.id), freeId: Number(free.id), paidId: Number(paid.id) };
}

function setProgress(userEmail, workId, percent) {
  const db = new DatabaseSync(path.join(DB_DIR, 'reader.db'));
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(userEmail);
  db.prepare(
    `INSERT INTO reading_progress (user_id, work_id, chapter_id, percent) VALUES (?,?,NULL,?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET percent = ?`,
  ).run(user.id, workId, percent, percent);
  db.close();
}

const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start', '-p', String(PORT), '--hostname', '127.0.0.1',
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    SQLITE_DIR: DB_DIR,
    JWT_SECRET: 'e2e-secret-value-at-least-32-chars-long',
    ADMIN_TOKEN: 'e2e-admin-token-at-least-32-characters',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d.toString(); });
server.stderr.on('data', (d) => { serverLog += d.toString(); });

async function main() {
  await waitForHealth();

  const { authorId, workId, freeId, paidId } = seed();

  // 1. Публичные страницы
  const home = await api('GET', `/${LANG}`);
  check('главная открывается', home.status === 200, `HTTP ${home.status}`);
  const workPage = await api('GET', `/${LANG}/work/e2e-work`);
  check('страница произведения открывается', workPage.status === 200, `HTTP ${workPage.status}`);

  // 2. Регистрация с датой рождения
  const reg = await api('POST', '/api/auth/register', {
    name: 'E2E Čitalac',
    email: `e2e-${Date.now()}@test.local`,
    password: 'e2e-password-123',
    birthDate: '2000-05-17',
  });
  check('регистрация с датой рождения', reg.status === 200, `HTTP ${reg.status}`);

  const regNoBirth = await api('POST', '/api/auth/register', {
    name: 'Без даты', email: `nobirth-${Date.now()}@test.local`, password: 'e2e-password-123',
  });
  check('регистрация без даты рождения отклоняется', regNoBirth.status === 400, `HTTP ${regNoBirth.status}`);

  const me = await api('GET', '/api/auth/me');
  const meJson = await me.json().catch(() => ({}));
  check('сессия после регистрации', me.status === 200 && Boolean(meJson?.user?.id), `HTTP ${me.status}`);

  // 3. Главы: доступ
  const guestPaid = await fetch(`${BASE}/api/chapter/text?chapter=${paidId}`);
  check('гость не получает платную главу', guestPaid.status === 401 || guestPaid.status === 403, `HTTP ${guestPaid.status}`);

  const readerPaid = await api('GET', `/api/chapter/text?chapter=${paidId}`);
  check('читатель без покупки не получает платную главу', readerPaid.status === 403, `HTTP ${readerPaid.status}`);

  const readerFree = await api('GET', `/api/chapter/text?chapter=${freeId}`);
  check('бесплатная глава доступна', readerFree.status === 200, `HTTP ${readerFree.status}`);

  // 4. Библиотека и статусы
  const lib = await api('POST', '/api/library', { workId });
  check('добавление в библиотеку', lib.status === 200, `HTTP ${lib.status}`);
  const libStatus = await api('POST', '/api/library', { workId, status: 'done' });
  check('смена статуса библиотеки', libStatus.status === 200, `HTTP ${libStatus.status}`);

  // 5. Коллекции
  const coll = await api('POST', '/api/collections', { title: `E2E подборка ${Date.now()}`, isPublic: true });
  const collJson = await coll.json().catch(() => ({}));
  check('создание коллекции', coll.status === 200 && Boolean(collJson?.collection?.id), `HTTP ${coll.status}`);
  if (collJson?.collection?.id) {
    const add = await api('POST', `/api/collections/${collJson.collection.id}/items`, { workId });
    check('добавление произведения в коллекцию', add.status === 200, `HTTP ${add.status}`);
  }

  // 6. Отзывы: порог 10%
  const early = await api('POST', '/api/reviews', { workId, body: 'Пишу отзыв раньше времени' });
  check('отзыв без прогресса отклоняется', early.status === 403, `HTTP ${early.status}`);

  setProgress(meJson.user.email, workId, 15);
  const review = await api('POST', '/api/reviews', { workId, body: 'Прочитал 15 процентов, пишу отзыв', rating: 4 });
  check('отзыв после 15% принимается', review.status === 200, `HTTP ${review.status}`);

  // 7. Жалобы и админка
  const report = await api('POST', '/api/reports', { targetType: 'work', targetId: workId, reason: 'spam' });
  check('жалоба принимается', report.status === 200, `HTTP ${report.status}`);

  const adminNoToken = await fetch(`${BASE}/api/admin/reports`);
  check('очередь жалоб закрыта без админ-сессии', adminNoToken.status === 403, `HTTP ${adminNoToken.status}`);

  // 8. Экспорт: платное — нельзя
  const exportDenied = await api('GET', '/api/export/pdf?slug=e2e-work');
  check('PDF платного произведения запрещён', exportDenied.status === 403 || exportDenied.status === 401, `HTTP ${exportDenied.status}`);

  // 9. Подписка на автора
  const follow = await api('POST', '/api/follow', { authorId });
  check('подписка на автора', follow.status === 200, `HTTP ${follow.status}`);

  // 10. Профиль
  const profile = await api('GET', '/api/profile');
  check('свой профиль читается', profile.status === 200, `HTTP ${profile.status}`);
}

main()
  .catch((e) => check('прогон без исключений', false, String(e).slice(0, 300)))
  .finally(async () => {
    server.kill('SIGTERM');
    await sleep(500);
    try { server.kill('SIGKILL'); } catch { /* уже остановлен */ }
    rmSync(DB_DIR, { recursive: true, force: true });

    const failed = results.filter((r) => !r.ok);
    console.log(`\nИтого: ${results.length - failed.length}/${results.length} прошло`);
    if (failed.length) {
      console.log('Провалено:');
      for (const f of failed) console.log(` - ${f.name} ${f.detail}`);
      process.exit(1);
    }
  });
