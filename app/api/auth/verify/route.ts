import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 });

  await initSchema();
  const row = await one<{ id: number; user_id: number; used_at: string | null; expires_at: string }>(
    'SELECT id, user_id, used_at, expires_at FROM email_tokens WHERE token = $1', [token]
  );
  if (!row) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if (row.used_at) return NextResponse.redirect(new URL('/sr?verified=already', url.origin));
  if (new Date(row.expires_at.replace(' ', 'T')).getTime() < Date.now()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 410 });
  }

  await query('UPDATE email_tokens SET used_at = now() WHERE id = $1', [row.id]);
  await query('UPDATE users SET email_verified = 1 WHERE id = $1', [row.user_id]);
  return NextResponse.redirect(new URL('/sr?verified=1', url.origin));
}
