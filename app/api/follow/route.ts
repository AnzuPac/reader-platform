import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { followerCount, follow, isFollowing, unfollow } from '@/lib/follows';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorIdFrom(req: Request): number {
  const raw = new URL(req.url).searchParams.get('authorId');
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export async function GET(req: Request) {
  const authorId = authorIdFrom(req);
  if (!authorId) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const s = await readSession();
  const [following, followers] = await Promise.all([
    s ? isFollowing(s.uid, authorId) : Promise.resolve(false),
    followerCount(authorId),
  ]);
  return NextResponse.json({ following, followers });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `follow:${s.uid}`), 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const authorId = Number(body?.authorId);
  const res = await follow(s.uid, authorId);
  if (!res.ok) {
    const status = res.reason === 'bad_input' ? 400 : 422;
    return NextResponse.json({ error: res.reason }, { status });
  }
  return NextResponse.json({ ok: true, following: true, followers: await followerCount(authorId) });
}

export async function DELETE(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const authorId = authorIdFrom(req);
  const res = await unfollow(s.uid, authorId);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: true, following: false, followers: await followerCount(authorId) });
}
