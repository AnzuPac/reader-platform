import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId);
  const value = Number(b?.value);
  if (!workId || !(value >= 1 && value <= 5)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  await query(
    `INSERT INTO ratings (user_id, work_id, value) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, work_id) DO UPDATE SET value = EXCLUDED.value`,
    [s.uid, workId, value]
  );
  const agg = await one<{ n: number; avg: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n, COALESCE(AVG(value), 0) AS avg FROM ratings WHERE work_id = $1`, [workId]
  );
  await query('UPDATE works SET ratings_count = $2, rating_avg = ROUND($3, 2) WHERE id = $1', [workId, agg?.n ?? 0, agg?.avg ?? 0]);
  return NextResponse.json({ ok: true, count: agg?.n ?? 0, avg: Number(agg?.avg ?? 0).toFixed(2) });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workId = Number(url.searchParams.get('workId'));
  if (!workId) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  const s = await readSession();
  const agg = await one<{ n: number; avg: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n, COALESCE(AVG(value), 0) AS avg FROM ratings WHERE work_id = $1`, [workId]
  );
  let mine = 0;
  if (s) {
    const m = await one<{ value: number }>('SELECT value FROM ratings WHERE user_id = $1 AND work_id = $2', [s.uid, workId]);
    mine = m?.value ?? 0;
  }
  return NextResponse.json({ count: agg?.n ?? 0, avg: Number(agg?.avg ?? 0).toFixed(2), mine });
}
