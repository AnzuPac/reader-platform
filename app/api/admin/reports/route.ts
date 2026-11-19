import { NextResponse } from 'next/server';
import { adminTokenOk } from '@/lib/admin';
import { listReports, reportCounts, resolveReport, type ResolveAction } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS: ResolveAction[] = ['dismiss', 'hide_comment', 'hide_review', 'hide_work'];

/** Очередь жалоб — только для админ-сессии (HttpOnly cookie или X-Admin-Token). */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const status = new URL(req.url).searchParams.get('status') || 'open';
  const [items, counts] = await Promise.all([listReports(status), reportCounts()]);
  return NextResponse.json({ items, counts });
}

/** Решение по жалобе: закрыть или скрыть объект. */
export async function PATCH(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const action = String(body?.action || '') as ResolveAction;
  if (!Number.isFinite(id) || id <= 0 || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const resolver = String(body?.resolver || 'admin').slice(0, 120);
  const res = await resolveReport(id, resolver, action);
  if (!res.ok) return NextResponse.json({ error: res.reason || 'failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
