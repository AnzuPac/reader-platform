import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

/** Новый порядок страниц: { chapterId, ids: number[] } — перенумерация 1..N. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const chapterId = Number(b?.chapterId);
  const ids: number[] = Array.isArray(b?.ids) ? b.ids.map(Number).filter(Boolean) : [];
  if (!chapterId || ids.length === 0) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const owns = await one(
    `SELECT 1 AS ok FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1 AND w.author_id = $2`, [chapterId, s.uid]
  );
  if (!owns) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // временный отрицательный диапазон, чтобы не нарушить уникальность (chapter_id, page_no)
  for (let i = 0; i < ids.length; i++) {
    await query('UPDATE chapter_pages SET page_no = $2 WHERE id = $1 AND chapter_id = $3', [ids[i], -(i + 1), chapterId]);
  }
  for (let i = 0; i < ids.length; i++) {
    await query('UPDATE chapter_pages SET page_no = $2 WHERE id = $1 AND chapter_id = $3', [ids[i], i + 1, chapterId]);
  }
  return NextResponse.json({ ok: true, total: ids.length });
}
