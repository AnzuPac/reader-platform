import { NextResponse } from 'next/server';
import { query, initSchema } from '@/lib/db';
import { hashPassword, setSessionCookies } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const name = String(body?.name || '').trim();
  if (!email || !password || !name) return NextResponse.json({ error: 'err_required' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  await initSchema();
  const exists = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.length) return NextResponse.json({ error: 'err_exists' }, { status: 409 });

  const hash = await hashPassword(password);
  const rows = await query<{ id: number; email: string; role: string; display_name: string }>(
    `INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3)
     RETURNING id, email, role, display_name`,
    [email, hash, name]
  );
  const u = rows[0];
  await setSessionCookies({ uid: u.id, email: u.email, role: u.role, name: u.display_name });
  return NextResponse.json({ ok: true, user: { id: u.id, email: u.email, name: u.display_name, role: u.role } });
}
