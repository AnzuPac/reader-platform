import { NextResponse } from 'next/server';
import { requireAuthor } from '@/lib/author';
import { getAuthorStats } from '@/lib/author-stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Статистика автора: читатели, пол/возраст/регион, докуда дочитали, закладки, подписчики, покупки. */
export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const stats = await getAuthorStats(s.uid);
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
}
