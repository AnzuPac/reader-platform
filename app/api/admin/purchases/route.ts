import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { markPurchasePaid, refundPurchase } from '@/lib/purchases';

export const dynamic = 'force-dynamic';

/** GET /api/admin/purchases?status=pending — покупки книг и глав для ручной оплаты. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';
  await initSchema();
  const rows = await query<Record<string, unknown>>(
    `SELECT p.id, p.amount_cents, p.currency, p.status, p.provider, p.created_at, p.paid_at,
            p.chapter_id, u.display_name AS user, u.email,
            w.title AS work, w.slug AS work_slug, c.title AS chapter, c.number AS chapter_number
       FROM purchases p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN works w ON w.id = p.work_id
       LEFT JOIN chapters c ON c.id = p.chapter_id
      WHERE p.status = $1
      ORDER BY p.created_at DESC LIMIT 100`,
    [status]
  );
  return NextResponse.json({ purchases: rows });
}

/** POST /api/admin/purchases — {purchaseId, action:'confirm'|'refund'}. */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const purchaseId = Number(b?.purchaseId);
  if (!purchaseId) return NextResponse.json({ error: 'purchase_required' }, { status: 400 });

  await initSchema();
  const exists = await one('SELECT id FROM purchases WHERE id = $1', [purchaseId]);
  if (!exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (b?.action === 'refund') {
    const res = await refundPurchase(purchaseId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true, refunded: true });
  }

  const res = await markPurchasePaid(purchaseId, b?.externalId ? String(b.externalId) : null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true, already: res.already, royalty: res.royalty });
}
