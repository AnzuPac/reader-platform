import { NextResponse } from 'next/server';
import { query, initSchema } from '@/lib/db';
import { verifyPassword, setSessionCookies } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) return NextResponse.json({ error: 'err_required' }, { status: 400 });

  await initSchema();
  const rows = await query<{ id: number; email: string; role: string; display_name: string; password_hash: string }>(
    'SELECT id, email, role, display_name, password_hash FROM users WHERE email = $1', [email]
  );
  const u = rows[0];
  if (!u || !u.password_hash || !(await verifyPassword(password, u.password_hash))) {
    return NextResponse.json({ error: 'err_credentials' }, { status: 401 });
  }
  await setSessionCookies({ uid: u.id, email: u.email, role: u.role, name: u.display_name });
  return NextResponse.json({ ok: true, user: { id: u.id, email: u.email, name: u.display_name, role: u.role } });
}
