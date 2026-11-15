import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import { setWorkPrice } from '@/lib/publisher';
import { enforceChapterCap } from '@/lib/purchases';

export const dynamic = 'force-dynamic';

/** POST /api/publisher/works/{id}/price — установить цену книги. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { id } = await ctx.params;
  const workId = Number(id);
  if (!Number.isFinite(workId)) return NextResponse.json({ error: 'bad_work_id' }, { status: 400 });

  const b = await req.json().catch(() => null);
  const amountCents = Number(b?.amountCents ?? b?.amount_cents);
  const currency = String(b?.currency || 'RSD');

  await initSchema();
  const res = await setWorkPrice(scope.publisherId, workId, {
    amount_cents: amountCents,
    currency,
    active: b?.active !== false,
  });
  if (!res.ok) {
    const status = res.error === 'not_found' ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  // P3: после смены цены книги главы приводим к потолку.
  const cap = await enforceChapterCap(workId);
  return NextResponse.json({
    ok: true, workId, amountCents, currency: currency.toUpperCase(),
    chapters_coins: cap.summary.chapters_coins, trimmed_coins: cap.trimmed,
  });
}
