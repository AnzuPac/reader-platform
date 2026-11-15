import { NextResponse } from 'next/server';
import { adminTokenOk } from '@/lib/admin';
import { initSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/pool/statement?month=YYYY-MM — выписка распределения (CSV). */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const month = String(new URL(req.url).searchParams.get('month') || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad_month' }, { status: 400 });
  await initSchema();
  const rows = await query<{ work_id: number; author_id: number | null; pages: number; cents: number }>(
    `SELECT pl.work_id, pl.author_id, pl.pages, pl.cents
       FROM pool_ledger pl JOIN pool_runs pr ON pr.id = pl.pool_run_id
      WHERE pr.month = $1 ORDER BY pl.cents DESC`, [month]
  );
  const lines = ['work_id,author_id,pages,cents'];
  for (const r of rows) lines.push([r.work_id, r.author_id ?? '', r.pages, r.cents].join(','));
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pool-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
