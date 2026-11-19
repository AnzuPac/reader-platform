import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/ratelimit';
import { createReport } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Жалоба на произведение, комментарий, отзыв или пользователя. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `report:${s.uid}`), 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const res = await createReport(s.uid, {
    targetType: body?.targetType,
    targetId: body?.targetId,
    reason: body?.reason,
    comment: body?.comment,
  });

  if (!res.ok) {
    const status = res.reason === 'not_found' ? 404 : 400;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, id: res.id, duplicate: res.duplicate });
}
