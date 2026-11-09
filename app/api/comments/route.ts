import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workSlug = url.searchParams.get('work');
  const chapterId = Number(url.searchParams.get('chapter') || 0);
  await initSchema();
  let workId = Number(url.searchParams.get('workId') || 0);
  if (!workId && workSlug) {
    const w = await one<{ id: number }>('SELECT id FROM works WHERE slug = $1', [workSlug]);
    workId = w?.id ?? 0;
  }
  if (!workId) return NextResponse.json({ comments: [] });

  const rows = chapterId
    ? await query(
        `SELECT c.id, c.body, c.created_at, u.display_name AS author, u.id AS user_id
           FROM comments c JOIN users u ON u.id = c.user_id
          WHERE c.work_id = $1 AND c.chapter_id = $2 AND c.status = 'visible'
          ORDER BY c.created_at DESC LIMIT 100`, [workId, chapterId])
    : await query(
        `SELECT c.id, c.body, c.created_at, u.display_name AS author, u.id AS user_id
           FROM comments c JOIN users u ON u.id = c.user_id
          WHERE c.work_id = $1 AND c.chapter_id IS NULL AND c.status = 'visible'
          ORDER BY c.created_at DESC LIMIT 100`, [workId]);
  return NextResponse.json({ comments: rows });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const body = String(b?.body || '').trim();
  const workId = Number(b?.workId);
  const chapterId = b?.chapterId ? Number(b.chapterId) : null;
  if (!workId || !body) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  if (body.length > 2000) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  await initSchema();
  const rows = await query<{ id: number }>(
    `INSERT INTO comments (user_id, work_id, chapter_id, body) VALUES ($1,$2,$3,$4) RETURNING id`,
    [s.uid, workId, chapterId, escapeHtml(body)]
  );
  return NextResponse.json({ ok: true, id: rows[0].id });
}
