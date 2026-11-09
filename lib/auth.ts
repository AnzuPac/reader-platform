import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me-in-prod-32chars');
export const ACCESS_COOKIE = 'rd_access';
export const REFRESH_COOKIE = 'rd_refresh';
const ACCESS_TTL = 60 * 60;           // 1 час
const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 дней

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
    .sign(SECRET);
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
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
