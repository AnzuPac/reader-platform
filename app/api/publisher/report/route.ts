import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import { can, getPublisher, memberRoleFor, publisherReport } from '@/lib/publisher';
import { readSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/publisher/report?from=&to=&format=csv — продажи, выручка, роялти, к выплате. */
export async function GET(req: Request) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const role = scope.isAdmin ? 'owner' : await memberRoleFor(session.uid, scope.publisherId);
  if (!can(role, 'finances')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await initSchema();
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  const publisher = await getPublisher(scope.publisherId);
  const report = await publisherReport(scope.publisherId, from, to);

  if (format === 'csv') {
    const lines: string[] = [];
    lines.push(['publisher', 'from', 'to', 'currency', 'sales', 'gross_cents', 'commission_cents', 'royalty_cents'].join(','));
    for (const r of report.byCurrency) {
      lines.push([
        csvCell(publisher?.slug || String(scope.publisherId)),
        report.from, report.to, r.currency, r.sales, r.gross_cents, r.commission_cents, r.royalty_cents,
      ].join(','));
    }
    lines.push('');
    lines.push(['work_id', 'slug', 'title', 'price_cents', 'currency', 'sales', 'gross_cents', 'royalty_cents'].join(','));
    for (const w of report.works) {
      lines.push([
        w.id, csvCell(w.slug), csvCell(w.title), w.amount_cents ?? 0, w.currency ?? '',
        w.sales, w.gross_cents, w.royalty_cents,
      ].join(','));
    }
    const body = `\uFEFF${lines.join('\n')}`;
    const slug = publisher?.slug || `publisher-${scope.publisherId}`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${slug}-${report.from}_${report.to}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ publisher, report });
}
