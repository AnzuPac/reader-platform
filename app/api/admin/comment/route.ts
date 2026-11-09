import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

/** Список комментариев для модерации (все статусы). */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  await initSchema();
  const rows = status
    ? await query(
        `SELECT c.id, c.body, c.status, c.created_at, u.display_name AS author, w.title AS work
           FROM comments c JOIN users u ON u.id = c.user_id JOIN works w ON w.id = c.work_id
          WHERE c.status = $1 ORDER BY c.created_at DESC LIMIT 100`, [status])
    : await query(
        `SELECT c.id, c.body, c.status, c.created_at, u.display_name AS author, w.title AS work
           FROM comments c JOIN users u ON u.id = c.user_id JOIN works w ON w.id = c.work_id
          ORDER BY c.created_at DESC LIMIT 100`);
  return NextResponse.json({ comments: rows });
}

/** action: hide | show | delete */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const action = String(b?.action || '');
  if (!id || !['hide', 'show', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  await initSchema();
  if (action === 'delete') await query('DELETE FROM comments WHERE id = $1', [id]);
  else await query('UPDATE comments SET status = $2 WHERE id = $1', [id, action === 'hide' ? 'hidden' : 'visible']);
  return NextResponse.json({ ok: true });
}
