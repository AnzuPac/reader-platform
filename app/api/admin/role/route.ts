import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

/** Назначить роль пользователю по e-mail (author / moderator / admin / reader). */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const email = String(b?.email || '').toLowerCase().trim();
  const role = String(b?.role || '');
  if (!email || !['reader','author','translator','moderator','admin'].includes(role)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  await initSchema();
  await query('UPDATE users SET role = $2 WHERE lower(email) = $1', [email, role]);
  return NextResponse.json({ ok: true, email, role });
}
