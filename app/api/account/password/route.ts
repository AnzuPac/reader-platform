import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession, hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const current = String(b?.current || '');
  const next = String(b?.next || '');
  if (next.length < 8) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  await initSchema();
  const u = await one<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [s.uid]);
  if (!u?.password_hash) return NextResponse.json({ error: 'no_password' }, { status: 400 });
  if (!(await verifyPassword(current, u.password_hash))) return NextResponse.json({ error: 'wrong_password' }, { status: 403 });

  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [s.uid, await hashPassword(next)]);
  return NextResponse.json({ ok: true });
}
