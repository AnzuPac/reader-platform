import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';
  await initSchema();
  const rows = await query(
    `SELECT p.id, p.amount_cents, p.currency, p.status, p.created_at, p.meta,
            u.display_name AS user, u.email
       FROM payments p JOIN users u ON u.id = p.user_id
      WHERE p.status = $1 ORDER BY p.created_at DESC LIMIT 100`, [status]);
  return NextResponse.json({ payments: rows });
}
