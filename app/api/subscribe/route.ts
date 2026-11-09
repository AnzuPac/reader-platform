import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const planCode = String(b?.planCode || '');
  if (!planCode) return NextResponse.json({ error: 'plan_required' }, { status: 400 });

  await initSchema();
  const plan = await one<{ code: string; price_cents: number; currency: string; period: string }>(
    'SELECT code, price_cents, currency, period FROM plans WHERE code = $1 AND active = 1', [planCode]
  );
  if (!plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });

  const rows = await query<{ id: number }>(
    `INSERT INTO payments (user_id, amount_cents, currency, method, status, meta)
     VALUES ($1,$2,$3,'transfer','pending',$4) RETURNING id`,
    [s.uid, plan.price_cents, plan.currency, JSON.stringify({ planCode })]
  );
  return NextResponse.json({
    ok: true,
    paymentId: rows[0].id,
    instructions: 'Uplata se vrši na račun izdavača. Nakon uplate administrator aktivira pretplatu.',
  });
}
