import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import { setChapterCoins } from '@/lib/purchases';
import { isCommerciallyEligible } from '@/lib/work-monetization-rules';

/** Publisher-controlled paid chapter price. Fanfiction/public-domain remains donation-only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const { id } = await ctx.params;
  const chapterId = Number(id);
  if (!Number.isInteger(chapterId) || chapterId <= 0) return NextResponse.json({ error: 'bad_chapter_id' }, { status: 400 });
  const b = await req.json().catch(() => null);
  const coins = Math.trunc(Number(b?.coins));
  if (!Number.isInteger(coins) || coins < 0 || coins > 1_000_000) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  await initSchema();
  const chapter = await one<{ id: number; work_id: number; publisher_id: number; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number }>(
    'SELECT c.id, c.work_id, w.publisher_id, w.kind, w.is_classic, w.rights_confirmed FROM chapters c JOIN works w ON w.id = c.work_id WHERE c.id = $1', [chapterId]
  );
  if (!chapter || chapter.publisher_id !== scope.publisherId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (coins > 0 && !isCommerciallyEligible(chapter)) return NextResponse.json({ error: 'non_commercial_work' }, { status: 403 });
  const book = await one<{ amount_cents: number }>('SELECT amount_cents FROM book_prices WHERE work_id = $1 AND active = 1', [chapter.work_id]);
  if (book && coins > 0) {
    const other = await one<{ total: number }>("SELECT COALESCE(SUM(COALESCE(cp.coins, CAST(ROUND(c.price_cents / 100.0) AS INTEGER))),0) AS total FROM chapters c LEFT JOIN chapter_prices cp ON cp.chapter_id = c.id AND cp.active = 1 WHERE c.work_id = $1 AND c.id <> $2 AND c.access = 'paid'", [chapter.work_id, chapterId]);
    const cap = Math.max(0, Math.round(Number(book.amount_cents) / 100) - Number(other?.total || 0));
    if (coins > cap) return NextResponse.json({ error: 'chapter_price_exceeds_book_price', maxCoins: cap }, { status: 400 });
  }
  await query("UPDATE chapters SET access = $2 WHERE id = $1", [chapterId, coins > 0 ? 'paid' : 'free']);
  // setChapterCoins intentionally supports self-published works only; publisher pricing is recorded here.
  const amountCents = coins * 100;
  await query(
    `INSERT INTO chapter_prices (chapter_id, coins, amount_cents, currency, active)
     VALUES ($1,$2,$3,'RSD',$4)
     ON CONFLICT (chapter_id) DO UPDATE SET coins = EXCLUDED.coins, amount_cents = EXCLUDED.amount_cents, currency = EXCLUDED.currency, active = EXCLUDED.active, updated_at = now()`,
    [chapterId, coins, amountCents, coins > 0 ? 1 : 0]
  );
  await query('UPDATE chapters SET price_cents = $2 WHERE id = $1', [chapterId, amountCents]);
  return NextResponse.json({ ok: true, chapterId, coins, active: coins > 0 });
}
