import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { authorDonationSummary } from '@/lib/donations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/author/donations — «Dobijeno», история донатов и выплаты автора. */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  await initSchema();
  const limit = Number(new URL(req.url).searchParams.get('limit')) || 50;
  const summary = await authorDonationSummary(s.uid, limit);
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store, private' } });
}
