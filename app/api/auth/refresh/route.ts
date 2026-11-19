import { NextResponse } from 'next/server';
import { rotateRefresh } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/** Обновление сессии по refresh-cookie с ротацией токена. */
export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'refresh'), 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const s = await rotateRefresh();
  if (!s) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user: { id: s.uid, email: s.email, name: s.name, role: s.role } });
}
