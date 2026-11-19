import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { requestAuthorPayout } from '@/lib/donations';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/author/payouts — заявка автора на выплату всего доступного баланса. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(`author-payout:${s.uid}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const b = await req.json().catch(() => null);
  await initSchema();
  const res = await requestAuthorPayout(s.uid, String(b?.currency || 'RSD'));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
