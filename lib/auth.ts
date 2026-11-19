import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getJwtSecret } from './secrets';

export const ACCESS_COOKIE = 'rd_access';
export const REFRESH_COOKIE = 'rd_refresh';
const ACCESS_TTL = 60 * 60;           // 1 час
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 дней

// Секрет читается лениво: в production без JWT_SECRET приложение падает
// на первом обращении к сессии, а не подписывает токены известной строкой.
function secret(): Uint8Array {
  return getJwtSecret();
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
  jar.set(ACCESS_COOKIE, access, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL, secure: process.env.NODE_ENV === 'production' });
  jar.set(REFRESH_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: REFRESH_TTL, secure: process.env.NODE_ENV === 'production' });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
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
