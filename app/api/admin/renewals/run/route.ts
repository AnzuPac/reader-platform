import { NextResponse } from 'next/server';
import { adminTokenOk } from '@/lib/admin';
import { initSchema } from '@/lib/db';
import { runRenewalReminders } from '@/lib/renewals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/renewals/run — напоминания о продлении подписки. */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const days = Math.max(1, Math.min(14, Number(b?.days) || 3));
  await initSchema();
  const summary = await runRenewalReminders(days);
  return NextResponse.json({ ok: true, ...summary });
}
