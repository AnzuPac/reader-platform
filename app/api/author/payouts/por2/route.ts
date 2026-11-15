import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { initSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/author/payouts/por2?year=YYYY — данные для POR-2: выплаты автора за год.
 * Формат CSV: datum, bruto, normirani_troskovi, porez, doprinosi, neto.
 */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();

  const year = Number(new URL(req.url).searchParams.get('year') || new Date().getFullYear());
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'bad_year' }, { status: 400 });
  }

  const rows = await query<{ paid_at: string; gross_cents: number; tax_cents: number; contributions_cents: number; net_cents: number }>(
    `SELECT paid_at, gross_cents, tax_cents, contributions_cents, net_cents
       FROM author_payouts
      WHERE author_id = $1 AND status = 'paid' AND substr(COALESCE(paid_at, created_at), 1, 4) = $2
      ORDER BY paid_at`, [s.uid, String(year)]
  );

  const lines = ['datum,bruto,normirani_troskovi,porez,doprinosi,neto'];
  for (const r of rows) {
    const gross = Number(r.gross_cents) || 0;
    const tax = Number(r.tax_cents) || 0;
    const contrib = Number(r.contributions_cents) || 0;
    const norm = Math.max(0, gross - tax - contrib - (Number(r.net_cents) || 0) >= 0 ? gross - Math.round(gross * 0.43) : 0);
    lines.push([String(r.paid_at || '').slice(0, 10), (gross / 100).toFixed(2), (norm / 100).toFixed(2), (tax / 100).toFixed(2), (contrib / 100).toFixed(2), ((Number(r.net_cents) || 0) / 100).toFixed(2)].join(','));
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="por2-${year}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
