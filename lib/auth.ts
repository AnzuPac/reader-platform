import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { getJwtSecret } from './secrets';
import { one, query } from './db';

export const ACCESS_COOKIE = 'rd_access';
export const REFRESH_COOKIE = 'rd_refresh';
const ACCESS_TTL = 60 * 60;           // 1 час
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 дней

// Секрет читается лениво: в production без JWT_SECRET приложение падает
// на первом обращении к сессии, а не подписывает токены известной строкой.
function secret(): Uint8Array {
  return getJwtSecret();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Сохраняем только хеш refresh-токена: утечка БД не даёт войти под пользователем. */
async function storeRefreshToken(uid: number, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000).toISOString();
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [uid, hashToken(token), expiresAt],
  );
}

async function revokeRefreshToken(token: string): Promise<void> {
  if (!token) return;
  await query(
    'UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL',
    [new Date().toISOString(), hashToken(token)],
  ).catch(() => {});
}

export type Session = { uid: number; email: string; role: string; name: string };

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 11);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signAccess(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(secret());
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: Number(payload.uid), email: String(payload.email), role: String(payload.role), name: String(payload.name) };
  } catch {
    return null;
  }
}

export async function setSessionCookies(s: Session): Promise<void> {
  const jar = await cookies();
  const access = await signAccess(s);
  const refresh = randomBytes(32).toString('hex');
  await storeRefreshToken(s.uid, refresh);
  jar.set(ACCESS_COOKIE, access, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL, secure: process.env.NODE_ENV === 'production' });
  // sameSite=strict: refresh уходит только со своего сайта.
  jar.set(REFRESH_COOKIE, refresh, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: REFRESH_TTL, secure: process.env.NODE_ENV === 'production' });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  await revokeRefreshToken(jar.get(REFRESH_COOKIE)?.value || '');
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/**
 * Обновление сессии по refresh-cookie с ротацией: старый токен гасится,
 * выдаётся новая пара. Раньше cookie была случайным UUID, который никто
 * не проверял, и пользователя разлогинивало через час (аудит, п.14).
 */
export async function rotateRefresh(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  if (!token) return null;

  // Атомарное потребление: UPDATE ... RETURNING гарантирует, что токен
  // заберёт только один параллельный запрос (находка review-2, P1).
  const now = new Date().toISOString();
  const row = await one<{ user_id: number }>(
    `UPDATE refresh_tokens SET revoked_at = $1
      WHERE token_hash = $2 AND revoked_at IS NULL AND expires_at > $1
      RETURNING user_id`,
    [now, hashToken(token)],
  ).catch(() => null);
  if (!row) return null;

  const u = await one<{ id: number; email: string; role: string; display_name: string; status: string }>(
    'SELECT id, email, role, display_name, status FROM users WHERE id = $1 AND deleted_at IS NULL',
    [row.user_id],
  ).catch(() => null);
  if (!u || (u.status || 'active') !== 'active') return null;

  const s: Session = { uid: u.id, email: u.email, role: u.role, name: u.display_name };
  await setSessionCookies(s);
  return s;
}

export async function signDeleteToken(uid: number): Promise<string> {
  return new SignJWT({ uid, purpose: 'delete' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret());
}

export async function verifyDeleteToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== 'delete') return null;
    const uid = Number(payload.uid);
    return Number.isFinite(uid) && uid > 0 ? uid : null;
  } catch { return null; }
}
