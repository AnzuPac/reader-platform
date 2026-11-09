import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { stripeEnabled } from '@/lib/payments';

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
    const paymentId = Number(session?.metadata?.paymentId);
    const planCode = String(session?.metadata?.planCode || 'reader');
    if (paymentId) {
      await initSchema();
      const pay = await query<{ user_id: number; status: string }>(
        'SELECT user_id, status FROM payments WHERE id = $1', [paymentId]
      );
      if (pay.length && pay[0].status !== 'paid') {
        await query("UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1", [paymentId]);
        await query(
          `INSERT INTO subscriptions (user_id, plan_code, status, current_period_start, current_period_end)
           VALUES ($1,$2,'active',now(), datetime('now','+30 days'))`,
          [pay[0].user_id, planCode]
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
