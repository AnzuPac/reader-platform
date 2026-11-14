import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { markPurchasePaid } from '@/lib/purchases';

/**
 * Подтверждение ручной оплаты.
 *  - {paymentId}  — подписка: платёж paid + подписка на 30 дней (как раньше);
 *  - {purchaseId} — разовая покупка книги/главы: доступ навсегда + роялти издателю.
 */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const purchaseId = Number(b?.purchaseId);
  const paymentId = Number(b?.paymentId);

  await initSchema();

  if (purchaseId) {
    const res = await markPurchasePaid(purchaseId, b?.externalId ? String(b.externalId) : null);
    if (!res.ok) {
      const status = res.error === 'not_found' ? 404 : 409;
      return NextResponse.json({ error: res.error }, { status });
    }
    return NextResponse.json({ ok: true, already: res.already, purchaseId, royalty: res.royalty });
  }

  if (!paymentId) return NextResponse.json({ error: 'payment_required' }, { status: 400 });

  const pay = await one<{ id: number; user_id: number; meta: string; status: string }>(
    'SELECT id, user_id, meta, status FROM payments WHERE id = $1', [paymentId]
  );
  if (!pay) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (pay.status === 'paid') return NextResponse.json({ ok: true, already: true });

  const meta = JSON.parse(pay.meta || '{}') as { planCode?: string };
  const planCode = meta.planCode || 'reader';

  await query("UPDATE payments SET status='paid', paid_at=now() WHERE id=$1", [paymentId]);
  await query(
    `INSERT INTO subscriptions (user_id, plan_code, status, current_period_start, current_period_end)
     VALUES ($1,$2,'active',now(), datetime('now','+30 days'))`,
    [pay.user_id, planCode]
  );
  return NextResponse.json({ ok: true, plan: planCode });
}
