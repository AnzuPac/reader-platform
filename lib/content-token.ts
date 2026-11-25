import { createHmac, timingSafeEqual } from 'node:crypto';

/** Короткоживущий токен на выдачу конкретной главы (5 минут).
 *  Не заменяет проверку прав: глава всё равно проходит chapterGate. */
const TTL_SECONDS = 5 * 60;

function secret(): string {
  const value = process.env.JWT_SECRET || process.env.AUTH_SECRET || '';
  if (!value) throw new Error('content_token: secret is not configured');
  return value;
}

export function signChapterToken(uid: number, chapterId: number): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${Math.trunc(uid)}.${Math.trunc(chapterId)}.${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, exp };
}

export function verifyChapterToken(token: string): { uid: number; chapterId: number; exp: number } | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const [uidRaw, chapterRaw, expRaw, sig] = parts;
  const uid = Number(uidRaw);
  const chapterId = Number(chapterRaw);
  const exp = Number(expRaw);
  if (!Number.isFinite(uid) || !Number.isFinite(chapterId) || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  let expected: string;
  try {
    expected = createHmac('sha256', secret()).update(`${uidRaw}.${chapterRaw}.${expRaw}`).digest('base64url');
  } catch {
    return null;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { uid, chapterId, exp };
}
