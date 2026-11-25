import { NextResponse } from 'next/server';
import { requireAuthor } from '@/lib/author';
import { authorDashboard } from '@/lib/author-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const data = await authorDashboard(s.uid);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, private' } });
}
