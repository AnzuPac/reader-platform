import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, getAdminToken, safeEqual } from '@/lib/secrets';

export const runtime = 'nodejs';

const TTL = 60 * 60 * 8; // 8 часов

/**
 * Админ-сессия: обменивает введённый токен на HttpOnly-cookie.
 * Токен больше не хранится в localStorage (его мог бы прочитать XSS).
 */
export async function POST(req: Request) {
  const need = getAdminToken();
  if (!need) {
    return NextResponse.json(
      { ok: false, error: 'admin_disabled', message: 'ADMIN_TOKEN не задан на сервере — админка закрыта' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || '').trim();
  if (!token || !safeEqual(token, need)) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: TTL,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

/** Проверка «я ещё админ?» — для восстановления состояния страницы без токена в JS. */
export async function GET(req: Request) {
  const need = getAdminToken();
  if (!need) return NextResponse.json({ ok: false, admin: false }, { status: 503 });
  const raw = req.headers.get('cookie') || '';
  const hit = raw
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${ADMIN_COOKIE}=`));
  const got = hit ? decodeURIComponent(hit.slice(ADMIN_COOKIE.length + 1)) : '';
  return NextResponse.json({ ok: true, admin: Boolean(got && safeEqual(got, need)) });
}

/** Выход: гасим cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
