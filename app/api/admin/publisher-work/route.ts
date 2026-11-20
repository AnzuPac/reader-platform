import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { isCommerciallyEligible } from '@/lib/work-monetization-rules';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/publisher-work — привязать произведение к издательству
 * и (опционально) задать цену книги. {workId|workSlug, publisherId|null, priceCents?}
 */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  await initSchema();

  const workId = Number(b?.workId) || null;
  const workSlug = String(b?.workSlug || '').trim();
  const work = workId
    ? await one<{ id: number; type: string; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number }>('SELECT id, type, kind, is_classic, rights_confirmed FROM works WHERE id = $1', [workId])
    : workSlug
      ? await one<{ id: number; type: string; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number }>('SELECT id, type, kind, is_classic, rights_confirmed FROM works WHERE slug = $1', [workSlug])
      : null;
  if (!work) return NextResponse.json({ error: 'work_not_found' }, { status: 404 });

  const publisherId = b?.publisherId === null || b?.publisherId === ''
    ? null
    : Number(b?.publisherId) || null;
  if (publisherId) {
    const pub = await one('SELECT id FROM publishers WHERE id = $1', [publisherId]);
    if (!pub) return NextResponse.json({ error: 'publisher_not_found' }, { status: 404 });
  }

  await query('UPDATE works SET publisher_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
    publisherId, work.id,
  ]);

  let priceCents: number | null = null;
  if (b?.priceCents !== undefined && b?.priceCents !== null && b?.priceCents !== '') {
    priceCents = Math.trunc(Number(b.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
    }
    if (priceCents > 0 && !isCommerciallyEligible(work)) return NextResponse.json({ error: 'non_commercial_work' }, { status: 403 });
    await query(
      `INSERT INTO book_prices (work_id, amount_cents, currency, active)
       VALUES ($1,$2,$3,1)
       ON CONFLICT (work_id) DO UPDATE SET
         amount_cents = excluded.amount_cents,
         currency = excluded.currency,
         active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [work.id, priceCents, String(b?.currency || 'RSD').toUpperCase().slice(0, 3)]
    );
  }

  return NextResponse.json({ ok: true, workId: work.id, publisherId, priceCents });
}
