import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { hashPassword, hashEmailToken } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'pwreset-confirm'), 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_attempts', retryAfter: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => null);
  const token = String(body?.token || '').trim();
  const password = String(body?.password || '');
  const confirmPassword = String(body?.confirmPassword || '');
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 });
  if (password.length < 12) return NextResponse.json({ error: 'weak_password', min: 12 }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });

  await initSchema();
  const row = await one<{ id: number; user_id: number; used_at: string | null; expires_at: string }>(
    'SELECT id, user_id, used_at, expires_at FROM password_reset_tokens WHERE token_hash = $1',
    [hashEmailToken(token)],
  );
  if (!row) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if (row.used_at) return NextResponse.json({ error: 'token_used' }, { status: 410 });
  const expires = new Date(String(row.expires_at).replace(' ', 'T')).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 410 });
  }

  const hash = await hashPassword(password);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, row.user_id]);
  await query('UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2', [new Date().toISOString(), row.id]);
  // Все выданные сессии отзываем: после смены пароля вход заново.
  await query('UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL',
    [new Date().toISOString(), row.user_id]).catch(() => {});

  return NextResponse.json({ ok: true });
}
