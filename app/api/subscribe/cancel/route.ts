import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { cancelSubscription } from '@/lib/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/subscribe/cancel — отмена в 2 нажатия; доступ до конца периода. */
export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const res = await cancelSubscription(s.uid);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true, active_until: res.until });
}
