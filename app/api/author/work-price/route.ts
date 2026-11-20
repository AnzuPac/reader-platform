import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { isCommerciallyEligible } from '@/lib/monetization-policy';
import { rateLimit } from '@/lib/ratelimit';

/** Self-published original works may be sold by their author. Fanfiction/public domain is donation-only. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const rl = await rateLimit(`author-work-price:${s.uid}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  const b = await req.json().catch(() => null);
  const slug = String(b?.workSlug || '').trim();
  const amountCents = Math.trunc(Number(b?.amountCents));
  const currency = String(b?.currency || 'RSD').toUpperCase();
  if (!slug || !Number.isInteger(amountCents) || amountCents < 0 || amountCents > 100_000_000 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  await initSchema();
  const work = await one<{ id: number; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number; publisher_id: number | null }>(
    'SELECT id, kind, is_classic, rights_confirmed, publisher_id FROM works WHERE slug = $1 AND author_id = $2', [slug, s.uid]
  );
  if (!work) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (work.publisher_id !== null) return NextResponse.json({ error: 'publisher_managed_work' }, { status: 403 });
  if (amountCents > 0 && !isCommerciallyEligible(work)) {
    return NextResponse.json({ error: 'non_commercial_work', message: 'Fanfiction and public-domain works may only receive voluntary donations.' }, { status: 403 });
  }
  await query(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (work_id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents, currency = EXCLUDED.currency, active = EXCLUDED.active, updated_at = now()`,
    [work.id, amountCents, currency, amountCents > 0 ? 1 : 0]
  );
  return NextResponse.json({ ok: true, workSlug: slug, amountCents, currency, active: amountCents > 0 });
}
