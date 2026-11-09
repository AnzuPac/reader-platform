import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  await initSchema();
  const rows = status
    ? await query(
        `SELECT w.id, w.slug, w.title, w.type, w.status, w.views_total, w.rating_avg,
                u.display_name AS author, u.email AS author_email
           FROM works w JOIN users u ON u.id = w.author_id
          WHERE w.status = $1 ORDER BY w.updated_at DESC LIMIT 100`, [status])
    : await query(
        `SELECT w.id, w.slug, w.title, w.type, w.status, w.views_total, w.rating_avg,
                u.display_name AS author, u.email AS author_email
           FROM works w JOIN users u ON u.id = w.author_id
          ORDER BY w.updated_at DESC LIMIT 100`);
  return NextResponse.json({ works: rows });
}
