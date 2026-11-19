import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import {
  createCoinOrder, attachCoinOrderCheckout, listCoinPackages, listWalletHistory,
  walletBalance, ensureWallet, getEconomySettings, setEconomySettings,
} from '@/lib/coins';
import { createCoinCheckout, stripeEnabled } from '@/lib/payments';
import { rateLimit } from '@/lib/ratelimit';
import { CURRENCY } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/wallet — баланс, пакеты, история и настройки расходов. */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  await ensureWallet(s.uid);

  const [balance, packages, history, settings] = await Promise.all([
    walletBalance(s.uid),
    listCoinPackages(),
    listWalletHistory(s.uid, 40),
    getEconomySettings(s.uid),
  ]);

  return NextResponse.json(
    { balance_coins: balance, currency: CURRENCY, coin_value_rsd: 1, packages, history, settings },
    { headers: { 'Cache-Control': 'no-store, private' } }
  );
}

/**
 * POST /api/wallet
 *  - { packageCode } — заявка на пополнение (Stripe или ручное подтверждение);
 *  - { action: 'settings', autoUnlock?, monthlySpendLimitCoins? } — лимиты расходов.
 */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();

  const b = await req.json().catch(() => null);

  if (b?.action === 'settings') {
    const settings = await setEconomySettings(s.uid, {
      autoUnlock: b.autoUnlock === undefined ? undefined : Boolean(b.autoUnlock),
      monthlySpendLimitCoins: b.monthlySpendLimitCoins === undefined
        ? undefined : Number(b.monthlySpendLimitCoins),
    });
    return NextResponse.json({ ok: true, settings });
  }

  const rl = await rateLimit(`wallet:${s.uid}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });

  const packageCode = String(b?.packageCode || '');
  if (!packageCode) return NextResponse.json({ error: 'package_required' }, { status: 400 });

  const created = await createCoinOrder(s.uid, packageCode, stripeEnabled() ? 'stripe' : 'manual');
  if (!created.ok) {
    const status = created.error === 'package_not_found' ? 404 : 400;
    return NextResponse.json({ error: created.error }, { status });
  }
  const order = created.order;

  if (stripeEnabled()) {
    const origin = new URL(req.url).origin;
    const lang = typeof b?.lang === 'string' && ['sr', 'en', 'ru'].includes(b.lang) ? b.lang : 'sr';
    const checkout = await createCoinCheckout({
      orderId: order.id,
      priceRsd: order.price_rsd,
      coins: order.coins,
      email: s.email,
      successUrl: `${origin}/${lang}/account?topup=1`,
      cancelUrl: `${origin}/${lang}/account`,
    });
    if (checkout.mode === 'stripe') {
      await attachCoinOrderCheckout(order.id, checkout.url);
      return NextResponse.json({ ok: true, mode: 'stripe', orderId: order.id, url: checkout.url });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'manual',
    orderId: order.id,
    order: { coins: order.coins, price_rsd: order.price_rsd },
    instructions: `Zahtev #${order.id}: uplata ${order.price_rsd} RSD. Moneti se dodaju odmah posle potvrde administratora.`,
  });
}
