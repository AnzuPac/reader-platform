import { timingSafeEqual } from 'node:crypto';

/**
 * Единая точка чтения секретов.
 *
 * Правило fail-closed: в production секрет обязателен, иначе приложение
 * падает на первом же обращении (а не подписывает токены известной строкой).
 * Резолв ленивый — чтобы `next build` не падал на этапе сборки, когда
 * переменных окружения ещё нет.
 */

const MIN_SECRET_LEN = 32;

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getJwtSecret(): Uint8Array {
  const raw = (process.env.JWT_SECRET || '').trim();
  if (raw.length >= MIN_SECRET_LEN) return new TextEncoder().encode(raw);

  if (raw.length > 0 && isProd()) {
    throw new Error(`JWT_SECRET too short: ${raw.length} chars, need >= ${MIN_SECRET_LEN}`);
  }
  if (isProd()) {
    throw new Error('JWT_SECRET is not set. Refusing to sign tokens in production.');
  }
  // Только для dev/test: стабильный локальный секрет, чтобы сессии не рвались
  // при перезапуске. В production эта ветка недостижима.
  return new TextEncoder().encode('dev-only-insecure-secret-do-not-use-in-prod');
}

/** Постоянное по времени сравнение строк (защита от утечки по таймингу). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Админ-токен: пустое значение = доступ закрыт (никаких дефолтов). */
export function getAdminToken(): string {
  const token = (process.env.ADMIN_TOKEN || '').trim();
  // В production короткий токен не считается токеном: админка закрыта,
  // а не «немного защищена» (находка review-2, P1).
  if (isProd() && token.length < MIN_SECRET_LEN) return '';
  return token;
}

export const ADMIN_COOKIE = 'rd_admin';
