import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { authorIncome } from '@/lib/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/author/income — доход автора, ставка 70/80, выплаты. */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  return NextResponse.json(await authorIncome(s.uid), { headers: { 'Cache-Control': 'no-store, private' } });
}
