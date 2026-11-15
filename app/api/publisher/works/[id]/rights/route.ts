import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';

export const dynamic = 'force-dynamic';

/** POST /api/publisher/works/{id}/rights — права по книге (ТЗ 6.1). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { id } = await ctx.params;
  const workId = Number(id);
  if (!Number.isFinite(workId)) return NextResponse.json({ error: 'bad_work_id' }, { status: 400 });

  await initSchema();
  const owned = await one<{ id: number }>('SELECT id FROM works WHERE id = $1 AND publisher_id = $2', [workId, scope.publisherId]);
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const b = await req.json().catch(() => null);
  const sale = b?.rights_sale === false || b?.rightsSale === false ? 0 : 1;
  const sub = b?.rights_subscription === false || b?.rightsSubscription === false ? 0 : 1;
  const windowDays = Math.max(0, Math.min(365, Number(b?.subscription_window_days ?? b?.subscriptionWindowDays ?? 0) || 0));
  const regions = String(b?.regions || 'RS').trim().toUpperCase().slice(0, 120) || 'RS';
  const tts = b?.tts_allowed || b?.ttsAllowed ? 1 : 0;
  const excerpt = Math.max(0, Math.min(50, Number(b?.free_excerpt_pct ?? b?.freeExcerptPct ?? 10) || 0));

  await query(
    `UPDATE works SET rights_sale = $2, rights_subscription = $3, subscription_window_days = $4,
            regions = $5, tts_allowed = $6, free_excerpt_pct = $7, updated_at = now()
      WHERE id = $1 AND publisher_id = $8`,
    [workId, sale, sub, windowDays, regions, tts, excerpt, scope.publisherId]
  );
  return NextResponse.json({ ok: true, rights: { rights_sale: sale, rights_subscription: sub, subscription_window_days: windowDays, regions, tts_allowed: tts, free_excerpt_pct: excerpt } });
}
