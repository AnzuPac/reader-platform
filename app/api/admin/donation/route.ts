import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { markAuthorPayoutPaid, markDonationPaid } from '@/lib/donations';

export const runtime = 'nodejs';

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
