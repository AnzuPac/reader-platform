/** Платёжный провайдер: Stripe, если задан ключ; иначе ручной режим. */
export type CheckoutResult = { mode: 'stripe'; url: string } | { mode: 'manual' };

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function priceFor(planCode: string): string | undefined {
  if (planCode === 'reader') return process.env.STRIPE_PRICE_READER;
  if (planCode === 'reader_plus') return process.env.STRIPE_PRICE_READER_PLUS;
  return undefined;
}

export async function createCheckout(opts: {
  planCode: string; email: string; origin: string; paymentId: number;
}): Promise<CheckoutResult> {
  const price = priceFor(opts.planCode);
  if (!stripeEnabled() || !price) return { mode: 'manual' };

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    customer_email: opts.email,
    success_url: `${opts.origin}/sr?paid=1`,
    cancel_url: `${opts.origin}/sr/subscribe`,
    metadata: { paymentId: String(opts.paymentId), planCode: opts.planCode },
  });
  return { mode: 'stripe', url: session.url as string };
}
