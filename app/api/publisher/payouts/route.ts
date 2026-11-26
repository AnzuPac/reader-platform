import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import { can, createPayout, listPayouts, markPayoutPaid, memberRoleFor } from '@/lib/publisher';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/publisher/payouts — история выплат. */
export async function GET(req: Request) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const role = scope.isAdmin ? 'owner' : await memberRoleFor(session.uid, scope.publisherId);
  if (!can(role, 'finances')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await initSchema();
  const payouts = await listPayouts(scope.publisherId);
  return NextResponse.json({ payouts });
}

/** POST /api/publisher/payouts — создать выплату {amountCents} или закрыть {payoutId, action:'paid'}. */
export async function POST(req: Request) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const role = scope.isAdmin ? 'owner' : await memberRoleFor(session.uid, scope.publisherId);
  if (!can(role, 'finances')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const b = await req.json().catch(() => null);
  await initSchema();

  if (b?.payoutId && b?.action === 'paid') {
    const res = await markPayoutPaid(scope.publisherId, Number(b.payoutId));
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
    return NextResponse.json({ ok: true, already: res.already });
  }

  const amountCents = Number(b?.amountCents ?? b?.amount_cents);
  const created = await createPayout(scope.publisherId, amountCents);
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
  return NextResponse.json({ ok: true, payoutId: created.id });
}
