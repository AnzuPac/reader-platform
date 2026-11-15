import { NextResponse } from 'next/server';
import { adminTokenOk } from '@/lib/admin';
import { initSchema } from '@/lib/db';
import { runPool } from '@/lib/pool-run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/pool/run {month:"YYYY-MM", revenueCents} — запуск распределения пула. */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const month = String(b?.month || '').trim();
  const revenueCents = Number(b?.revenueCents ?? b?.revenue_cents ?? 0);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad_month' }, { status: 400 });
  await initSchema();
  try {
    const res = await runPool(month, revenueCents);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || 'failed') }, { status: 422 });
  }
}
