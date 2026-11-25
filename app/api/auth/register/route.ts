import { NextResponse } from 'next/server';
import { query, initSchema } from '@/lib/db';
import { hashPassword, setSessionCookies, hashEmailToken } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { sendEmail, mailConfigured } from '@/lib/mail';
import { verifyTurnstile } from '@/lib/turnstile';
import { randomBytes } from 'node:crypto';
import { MIN_AGE, calcAge, parseBirthDate } from '@/lib/age';

const SITE = process.env.SITE_URL || 'https://terolibrary.com';

export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'register'), 5, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_attempts', retryAfter: rl.retryAfter }, { status: 429 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const confirmPassword = String(body?.confirmPassword || '');
  const name = String(body?.name || '').trim();
  const lang = ['sr', 'ru', 'en'].includes(String(body?.lang)) ? String(body?.lang) : 'sr';

  if (!email || !password || !name) return NextResponse.json({ error: 'err_required' }, { status: 400 });
  if (password.length < 12) return NextResponse.json({ error: 'weak_password', min: 12 }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const captcha = await verifyTurnstile(String(body?.turnstileToken || ''), ip);
  if (!captcha.ok) {
    const status = captcha.error === 'turnstile_not_configured' ? 503 : 403;
    return NextResponse.json({ error: captcha.error || 'turnstile_failed' }, { status });
  }

  const rawBirthDate = String(body?.birthDate || '').trim();
  if (!rawBirthDate) return NextResponse.json({ error: 'birthdate_required' }, { status: 400 });
  const birth = parseBirthDate(rawBirthDate);
  if (!birth) return NextResponse.json({ error: 'birthdate_invalid' }, { status: 400 });
  if (calcAge(birth) < MIN_AGE) return NextResponse.json({ error: 'too_young', minAge: MIN_AGE }, { status: 403 });

  await initSchema();
  const exists = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.length) return NextResponse.json({ error: 'err_exists' }, { status: 409 });

  const hash = await hashPassword(password);
  const rows = await query<{ id: number; email: string; role: string; display_name: string }>(
    `INSERT INTO users (email, password_hash, display_name, birth_date, email_verified) VALUES ($1,$2,$3,$4,FALSE)
     RETURNING id, email, role, display_name`,
    [email, hash, name, rawBirthDate],
  );
  const u = rows[0];

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await query(
    'INSERT INTO email_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
    [u.id, hashEmailToken(token), expires],
  );

  const verifyLink = `${SITE}/api/auth/verify?token=${token}&lang=${lang}`;
  const mail = await sendEmail(
    email,
    lang === 'ru' ? 'Подтвердите почту — TeroLibrary' : lang === 'en' ? 'Confirm your email — TeroLibrary' : 'Potvrdite e-poštu — TeroLibrary',
    `<p>${lang === 'ru' ? 'Спасибо за регистрацию.' : lang === 'en' ? 'Thanks for signing up.' : 'Hvala na registraciji.'}</p>
     <p><a href="${verifyLink}">${lang === 'ru' ? 'Подтвердить почту' : lang === 'en' ? 'Confirm email' : 'Potvrdi e-poštu'}</a></p>
     <p>${lang === 'ru' ? 'Ссылка действует 48 часов.' : lang === 'en' ? 'The link is valid for 48 hours.' : 'Link važi 48 sati.'}</p>`,
  );

  await setSessionCookies({ uid: u.id, email: u.email, role: u.role, name: u.display_name });

  return NextResponse.json({
    ok: true,
    user: { id: u.id, email: u.email, name: u.display_name, role: u.role },
    emailSent: mail.ok && !mail.skipped,
    mailConfigured: mailConfigured(),
    // Ссылка только в режиме разработки, чтобы не утекал токен на проде.
    devVerifyUrl: !mailConfigured() && process.env.NODE_ENV !== 'production' ? verifyLink : undefined,
  });
}
