import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'won', 'lost'];

/** GET /api/admin/publisher-leads — заявки со страницы издательств. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const leads = await query(
    `SELECT id, name, company, email, phone, message, status, created_at
       FROM publisher_leads ORDER BY created_at DESC LIMIT 200`
  );
  return NextResponse.json({ leads });
}

/** POST /api/admin/publisher-leads — {leadId, status:'contacted'|'won'|'lost'|'new'}. */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const leadId = Number(b?.leadId);
  const status = String(b?.status || 'contacted');
  if (!leadId) return NextResponse.json({ error: 'lead_required' }, { status: 400 });
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 });

  await initSchema();
  const rows = await query<{ id: number }>(
    'UPDATE publisher_leads SET status = $1 WHERE id = $2 RETURNING id', [status, leadId]
  );
  if (!rows.length) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, leadId, status });
}
