import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { attachDonationCheckout, createDonation } from '@/lib/donations';
import { createDonationCheckout, stripeEnabled } from '@/lib/payments';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, number> = {
  invalid_amount: 400,
  message_too_long: 400,
  self_donation: 400,
  work_not_found: 404,
  chapter_not_found: 404,
  chapter_work_mismatch: 400,
};

/** POST /api/donate — поддержать автора (произведение или глава). */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = rateLimit(`donate:${s.uid}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const b = await req.json().catch(() => null);
  await initSchema();

  const res = await createDonation(
    s.uid,
    {
      workId: Number(b?.workId) || null,
      chapterId: Number(b?.chapterId) || null,
      amountCents: b?.amountCents ?? b?.amount_cents,
      message: b?.message,
    },
    stripeEnabled() ? 'stripe' : 'manual'
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: ERRORS[res.error] ?? 400 });
  }

  const d = res.donation;
  if (d.provider === 'stripe') {
    const origin = new URL(req.url).origin;
    const lang = typeof b?.lang === 'string' && ['sr', 'en', 'ru'].includes(b.lang) ? b.lang : 'sr';
    const checkout = await createDonationCheckout({
      donationId: d.id,
      amountCents: d.amount_cents,
      currency: d.currency,
      title: 'Podrška autoru',
      email: s.email,
      successUrl: `${origin}/${lang}/library?donated=1`,
      cancelUrl: `${origin}/${lang}`,
    });
    if (checkout.mode === 'stripe') {
      await attachDonationCheckout(d.id, checkout.url);
      return NextResponse.json({ ok: true, mode: 'stripe', donationId: d.id, url: checkout.url });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'manual',
    donationId: d.id,
    amountCents: d.amount_cents,
    currency: d.currency,
    feeCents: d.fee_cents,
    authorCents: d.author_cents,
    instructions:
      'Uplata se potvrđuje ručno. Autor dobija ' +
      (d.author_cents / 100).toFixed(2) +
      ' ' +
      d.currency +
      ' nakon potvrde.',
  });
}
