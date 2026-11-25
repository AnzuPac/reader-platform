import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { hashEmailToken } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  // Язык берём из ссылки письма, а не жёстким /sr (аудит, п.26).
  const rawLang = (url.searchParams.get('lang') || 'sr').toLowerCase();
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 });

  await initSchema();
  // Токен хранится хешем; старые строки с открытым токеном поддерживаем.
  const tokenHash = hashEmailToken(token);
  const row = await one<{ id: number; user_id: number; used_at: string | null; expires_at: string }>(
    'SELECT id, user_id, used_at, expires_at FROM email_tokens WHERE token = $1 OR token = $2', [tokenHash, token]
  );
  if (!row) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if (row.used_at) return NextResponse.redirect(new URL(`/${lang}?verified=already`, url.origin));
  if (new Date(row.expires_at.replace(' ', 'T')).getTime() < Date.now()) {
    return NextResponse.json({ error: 'token_expired' }, { status: 410 });
  }

  await query('UPDATE email_tokens SET used_at = now() WHERE id = $1', [row.id]);
  await query('UPDATE users SET email_verified = TRUE WHERE id = $1', [row.user_id]);
  return NextResponse.redirect(new URL(`/${lang}?verified=1`, url.origin));
}
