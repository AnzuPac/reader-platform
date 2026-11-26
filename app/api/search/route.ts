import { NextResponse } from 'next/server';
import { listWorks } from '@/lib/repo';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight live suggestions. The catalogue remains the canonical full result page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const rl = await rateLimit(clientKey(req, 'quick-search'), 45, 60_000);
  if (!rl.ok) return NextResponse.json({ items: [], error: 'rate_limited' }, { status: 429 });

  try {
    const works = await listWorks({ q, sort: 'views', limit: 8, offset: 0 });
    const items = works.map((work) => ({
      slug: work.slug,
      title: work.title,
      author: work.author_name,
      description: (work.description || '').slice(0, 150),
      cover: work.cover_path,
      type: work.kind === 'fanfic' ? 'fanfic' : work.type === 'comic' ? 'graphic' : 'book',
      rating: Number(work.rating_avg) || 0,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: 'search_unavailable' }, { status: 503 });
  }
}
