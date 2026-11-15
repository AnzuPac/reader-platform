import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

async function loadChapter(id: number) {
  return one<{ id: number; work_id: number; enabled: number }>(
    `SELECT c.id, c.work_id, w.paragraph_comments_enabled AS enabled
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1 AND c.status = 'published'`, [id]
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const chapterId = Number(id);
  if (!Number.isFinite(chapterId)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await initSchema();
  const ch = await loadChapter(chapterId);
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!ch.enabled) return NextResponse.json({ enabled: false, comments: [] }, { headers: NO_STORE });
  const comments = await query(
    `SELECT pc.id, pc.paragraph_index, pc.body, pc.created_at, u.display_name AS author
       FROM paragraph_comments pc JOIN users u ON u.id = pc.user_id
      WHERE pc.chapter_id = $1 AND pc.hidden = 0 ORDER BY pc.paragraph_index, pc.id`, [chapterId]
  );
  return NextResponse.json({ enabled: true, comments }, { headers: NO_STORE });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const chapterId = Number(id);
  if (!Number.isFinite(chapterId)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const ch = await loadChapter(chapterId);
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!ch.enabled) return NextResponse.json({ error: 'comments_disabled' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const idx = Number(b?.paragraph_index);
  const body = String(b?.body || '').trim();
  if (!Number.isInteger(idx) || idx < 0) return NextResponse.json({ error: 'bad_index' }, { status: 400 });
  if (body.length < 1 || body.length > 1000) return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  const rows = await query<{ id: number }>(
    `INSERT INTO paragraph_comments (chapter_id, work_id, paragraph_index, user_id, body)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [chapterId, ch.work_id, idx, s.uid, body]
  );
  return NextResponse.json({ ok: true, id: rows[0]?.id }, { headers: NO_STORE });
}
