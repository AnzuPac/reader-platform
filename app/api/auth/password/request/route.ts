import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { hashEmailToken } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { sendEmail, mailConfigured } from '@/lib/mail';
import { randomBytes } from 'node:crypto';

const SITE = process.env.SITE_URL || 'https://terolibrary.com';

export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'pwreset'), 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_attempts', retryAfter: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const lang = ['sr', 'ru', 'en'].includes(String(body?.lang)) ? String(body?.lang) : 'sr';
  // Ответ всегда одинаковый: не раскрываем, есть ли такой аккаунт.
  if (!email) return NextResponse.json({ ok: true });

  await initSchema();
  const rows = await query<{ id: number; email: string }>('SELECT id, email FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (user) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
      [user.id, hashEmailToken(token), expires],
    );
    const link = `${SITE}/${lang}/reset?token=${token}`;
    const mail = await sendEmail(
      email,
      lang === 'ru' ? 'Сброс пароля — TeroLibrary' : lang === 'en' ? 'Password reset — TeroLibrary' : 'Promena lozinke — TeroLibrary',
      `<p>${lang === 'ru' ? 'Вы запросили сброс пароля.' : lang === 'en' ? 'You requested a password reset.' : 'Zatražili ste promenu lozinke.'}</p>
       <p><a href="${link}">${lang === 'ru' ? 'Задать новый пароль' : lang === 'en' ? 'Set a new password' : 'Postavi novu lozinku'}</a></p>
       <p>${lang === 'ru' ? 'Ссылка действует 1 час. Если это были не вы — просто игнорируйте письмо.' : lang === 'en' ? 'The link is valid for 1 hour. If it was not you, ignore this email.' : 'Link važi 1 sat. Ako niste vi, zanemarite poruku.'}</p>`,
    );
    if (!mailConfigured() && process.env.NODE_ENV !== 'production') {
      console.info('[password-reset] dev link:', link);
    }
  }
  return NextResponse.json({ ok: true });
}
