import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { startPurchase, attachCheckoutSession, purchaseChapterWithCoins } from '@/lib/purchases';
import { createPurchaseCheckout, stripeEnabled } from '@/lib/payments';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, number> = {
  bad_target: 400,
  not_for_sale: 400,
  work_not_found: 404,
  chapter_not_found: 404,
};

/** POST /api/purchase — купить книгу (workId) или главу комикса (chapterId). */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(`purchase:${s.uid}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId) || null;
  const chapterId = Number(b?.chapterId) || null;
  if (!workId && !chapterId) {
    return NextResponse.json({ error: 'target_required' }, { status: 400 });
  }

  await initSchema();

  // Главы продаются только за монеты (ТЗ 4.8): явное согласие обязательно,
  // автопокупка isključenа, лимит mesecа проверяется в purchaseChapterWithCoins.
  if (chapterId) {
    const buy = await purchaseChapterWithCoins(s.uid, chapterId, { consent: Boolean(b?.consent) });
    if (!buy.ok) {
      const status = buy.error === 'consent_required' ? 400
        : buy.error === 'insufficient_coins' || buy.error === 'monthly_limit_exceeded' ? 402
        : buy.error === 'purchase_failed' ? 409
        : 404;
      return NextResponse.json({ error: buy.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      mode: 'coins',
      purchaseId: buy.purchaseId,
      coins: buy.coins,
      balance: buy.balance,
      already: buy.already,
    });
  }

  const res = await startPurchase(
    s.uid,
    { workId, chapterId },
    stripeEnabled() ? 'stripe' : 'manual'
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: ERRORS[res.error] ?? 400 });
  }
  if (res.already) {
    return NextResponse.json({ ok: true, already: true, purchaseId: res.purchase.id });
  }

  const origin = new URL(req.url).origin;
  const lang = typeof b?.lang === 'string' && ['sr', 'en', 'ru'].includes(b.lang) ? b.lang : 'sr';
  const checkout = await createPurchaseCheckout({
    purchaseId: res.purchase.id,
    amountCents: res.purchase.amount_cents,
    currency: res.purchase.currency,
    title: res.target.title,
    email: s.email,
    successUrl: `${origin}/${lang}/library?paid=1`,
    cancelUrl: `${origin}/${lang}/work/${res.target.slug}`,
  });

  if (checkout.mode === 'stripe') {
    await attachCheckoutSession(res.purchase.id, checkout.url);
    return NextResponse.json({ ok: true, mode: 'stripe', purchaseId: res.purchase.id, url: checkout.url });
  }

  return NextResponse.json({
    ok: true,
    mode: 'manual',
    purchaseId: res.purchase.id,
    amountCents: res.purchase.amount_cents,
    currency: res.purchase.currency,
    instructions:
      'Uplata se vrši na račun izdavača. Knjiga se otključava odmah nakon što administrator potvrdi uplatu.',
  });
}
