import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { setWorkExclusivity } from '@/lib/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/author/exclusivity {workId, exclusivity} — бонус 80% вместо 70%. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId);
  if (!workId) return NextResponse.json({ error: 'work_required' }, { status: 400 });
  const res = await setWorkExclusivity(s.uid, workId, Boolean(b?.exclusivity));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true, workId, exclusivity: Boolean(b?.exclusivity), share_pct: b?.exclusivity ? 80 : 70 });
}
