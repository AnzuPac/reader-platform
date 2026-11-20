import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { initSchema, one, query } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';

/** Existing reader account opts into the author role; no duplicate account is created. */
export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const limit = await rateLimit(`author-register:${session.uid}`, 3, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  await initSchema();
  const user = await one<{ role: string; status: string }>(
    'SELECT role, status FROM users WHERE id = $1 AND deleted_at IS NULL', [session.uid]
  );
  if (!user || user.status !== 'active') return NextResponse.json({ error: 'account_unavailable' }, { status: 403 });
  if (user.role === 'author') return NextResponse.json({ ok: true, alreadyAuthor: true, role: 'author' });
  if (user.role !== 'reader') return NextResponse.json({ error: 'role_not_eligible' }, { status: 403 });
  await query("UPDATE users SET role = 'author' WHERE id = $1 AND role = 'reader'", [session.uid]);
  return NextResponse.json({ ok: true, role: 'author', cabinet: '/author' });
}
