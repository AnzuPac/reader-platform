import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { markAuthorPayoutPaid, markDonationPaid } from '@/lib/donations';

export const runtime = 'nodejs';

/** GET /api/admin/donation?status=pending — донаты для ручного подтверждения. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const status = new URL(req.url).searchParams.get('status') || 'pending';
  await initSchema();
  const donations = await query(
    `SELECT d.id, d.amount_cents, d.fee_cents, d.author_cents, d.currency, d.status,
            d.message, d.created_at, u.display_name AS user, u.email,
            a.display_name AS author, w.title AS work
       FROM donations d
       JOIN users u ON u.id = d.user_id
       JOIN users a ON a.id = d.author_id
       JOIN works w ON w.id = d.work_id
      WHERE d.status = $1 ORDER BY d.created_at DESC LIMIT 100`, [status]);
  return NextResponse.json({ donations });
}

/** POST /api/admin/donation — ручное подтверждение доната или выплаты автору. */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  await initSchema();

  const payoutId = Number(b?.payoutId);
  if (payoutId) {
    const res = await markAuthorPayoutPaid(payoutId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === 'not_found' ? 404 : 409 });
    return NextResponse.json({ ok: true, already: res.already, payoutId });
  }

  const donationId = Number(b?.donationId);
  if (!donationId) return NextResponse.json({ error: 'donation_required' }, { status: 400 });

  const res = await markDonationPaid(donationId, b?.externalId ? String(b.externalId) : null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === 'not_found' ? 404 : 409 });
  return NextResponse.json({
    ok: true,
    already: res.already,
    donationId,
    authorCents: res.donation.author_cents,
    currency: res.donation.currency,
  });
}
