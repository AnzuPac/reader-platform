import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { readSession, hashEmailToken } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { sendEmail, mailConfigured } from '@/lib/mail';

const SITE = process.env.SITE_URL || 'https://terolibrary.com';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, 'verify-resend'), 3, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_attempts', retryAfter: rl.retryAfter }, { status: 429 });

  const user = await one<{ email: string; email_verified: number | boolean; locale: string | null }>(
    'SELECT email, email_verified, locale FROM users WHERE id = $1', [session.uid],
  );
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (user.email_verified === 1 || user.email_verified === true) {
    return NextResponse.json({ error: 'already_verified' }, { status: 400 });
  }
  // Без почтового ключа честно говорим, что письмо уйти не может.
  if (!mailConfigured()) return NextResponse.json({ error: 'mail_not_configured' }, { status: 503 });

  const lang = user.locale === 'ru' || user.locale === 'en' ? user.locale : 'sr';
  await query('UPDATE email_tokens SET used_at = $1 WHERE user_id = $2 AND used_at IS NULL',
    [new Date().toISOString(), session.uid]).catch(() => {});

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await query('INSERT INTO email_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
    [session.uid, hashEmailToken(token), expires]);

  const link = `${SITE}/api/auth/verify?token=${token}&lang=${lang}`;
  const subject = lang === 'ru' ? 'Подтвердите почту — TeroLibrary' : lang === 'en' ? 'Confirm your email — TeroLibrary' : 'Potvrdite e-poštu — TeroLibrary';
  const mail = await sendEmail(user.email, subject,
    `<p>${lang === 'ru' ? 'Подтвердите адрес почты.' : lang === 'en' ? 'Please confirm your email.' : 'Potvrdite svoju e-poštu.'}</p>
     <p><a href="${link}">${lang === 'ru' ? 'Подтвердить' : lang === 'en' ? 'Confirm' : 'Potvrdi'}</a></p>`);
  if (!mail.ok) return NextResponse.json({ error: 'mail_failed' }, { status: 502 });

  return NextResponse.json({ ok: true });
}
