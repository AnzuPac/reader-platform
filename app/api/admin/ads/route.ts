import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const rows = await query('SELECT code, title, html, active FROM ad_slots ORDER BY code');
  return NextResponse.json({ slots: rows });
}

export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const code = String(b?.code || '');
  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });
  await initSchema();
  await query(
    `UPDATE ad_slots SET html = $2, active = $3 WHERE code = $1`,
    [code, String(b?.html || ''), b?.active ? 1 : 0]
  );
  return NextResponse.json({ ok: true });
}
