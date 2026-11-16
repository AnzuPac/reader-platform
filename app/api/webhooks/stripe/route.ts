import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { stripeEnabled } from '@/lib/payments';
import { markPurchasePaid } from '@/lib/purchases';
import { markDonationPaid } from '@/lib/donations';
import { markCoinOrderPaid } from '@/lib/coins';
import { activateSubscription } from '@/lib/subscriptions';

export const runtime = 'nodejs';

/** Приём событий Stripe: активируем подписку после успешной оплаты. */
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ error: 'stripe_disabled' }, { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature') || '';
  const payload = await req.text();

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

  let event: any;
  try {
    event = secret ? stripe.webhooks.constructEvent(payload, signature, secret) : JSON.parse(payload);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Пакет монет: начисление в кошелёк.
    const coinOrderId = Number(session?.metadata?.coinOrderId);
    if (coinOrderId) {
      await initSchema();
      const res = await markCoinOrderPaid(coinOrderId, String(session?.id || ''));
      return NextResponse.json({ received: true, coins: res.ok, already: res.ok ? res.already : false });
    }

    // Разовая покупка книги/главы: доступ навсегда + роялти издателю.
    const purchaseId = Number(session?.metadata?.purchaseId);
    if (purchaseId) {
      await initSchema();
      const res = await markPurchasePaid(purchaseId, String(session?.id || ''));
      return NextResponse.json({ received: true, purchase: res.ok, already: res.ok ? res.already : false });
    }

    // Донат autoru: подтверждение оплаты и начисление доли автора.
    const donationId = Number(session?.metadata?.donationId);
    if (donationId) {
      await initSchema();
      const res = await markDonationPaid(donationId, String(session?.id || ''));
      return NextResponse.json({ received: true, donation: res.ok, already: res.ok ? res.already : false });
    }

    const paymentId = Number(session?.metadata?.paymentId);
    const planCode = String(session?.metadata?.planCode || 'month');
    if (paymentId) {
      await initSchema();
      const pay = await query<{ user_id: number; status: string }>(
        'SELECT user_id, status FROM payments WHERE id = $1', [paymentId]
      );
      if (pay.length && pay[0].status !== 'paid') {
        await query("UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1", [paymentId]);
        await activateSubscription(pay[0].user_id, planCode);
      }
    }
  }

  return NextResponse.json({ received: true });
}
