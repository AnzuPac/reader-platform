import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';
import {
  deleteOwnReview, listReviews, myReview, reviewEligibility, upsertReview,
} from '@/lib/reviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workId = Number(url.searchParams.get('workId'));
  if (!Number.isFinite(workId) || workId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const reviews = await listReviews(workId);
  const s = await readSession();
  if (!s) return NextResponse.json({ reviews, me: null });

  const [eligibility, mine] = await Promise.all([
    reviewEligibility(s.uid, workId),
    myReview(s.uid, workId),
  ]);
  return NextResponse.json({ reviews, me: { ...eligibility, review: mine } });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `review:${s.uid}`), 10, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const workId = Number(body?.workId);
  if (!Number.isFinite(workId) || workId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const res = await upsertReview(s.uid, workId, {
    rating: body?.rating === undefined ? null : Number(body.rating),
    body: String(body?.body || ''),
  });
  if (!res.ok) {
    const status = res.reason === 'not_eligible' ? 403 : 400;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, id: res.id });
}

export async function DELETE(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await deleteOwnReview(s.uid, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
