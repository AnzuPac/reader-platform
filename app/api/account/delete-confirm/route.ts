import { NextResponse } from 'next/server';
import { readSession, verifyDeleteToken, verifyPassword, clearSessionCookies } from '@/lib/auth';
import { one } from '@/lib/db';
import { deleteAccount } from '@/lib/account';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const token = String(body?.token || '');
  const uid = await verifyDeleteToken(token);
  if (!uid || uid !== s.uid) return NextResponse.json({ error: 'bad_token' }, { status: 400 });

  const user = await one<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [uid]);
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (user.password_hash) {
    const ok = await verifyPassword(String(body?.password || ''), user.password_hash);
    if (!ok) return NextResponse.json({ error: 'bad_password' }, { status: 403 });
  }
  await deleteAccount(uid);
  await clearSessionCookies();
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
