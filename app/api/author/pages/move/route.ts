import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

/** Перемещение страницы: dir = up | down (обмен номерами). */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const dir = String(b?.dir || '');
  if (!id || !['up', 'down'].includes(dir)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const row = await one<{ chapter_id: number; page_no: number }>(
    `SELECT p.chapter_id, p.page_no FROM chapter_pages p
       JOIN chapters c ON c.id = p.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE p.id = $1 AND w.author_id = $2`, [id, s.uid]
  );
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const neighborNo = dir === 'up' ? row.page_no - 1 : row.page_no + 1;
  const neighbor = await one<{ id: number }>(
    'SELECT id FROM chapter_pages WHERE chapter_id = $1 AND page_no = $2', [row.chapter_id, neighborNo]
  );
  if (!neighbor) return NextResponse.json({ ok: true, moved: false });

  // временный номер, чтобы не нарушить уникальность (chapter_id, page_no)
  await query('UPDATE chapter_pages SET page_no = -1 WHERE id = $1', [id]);
  await query('UPDATE chapter_pages SET page_no = $2 WHERE id = $1', [neighbor.id, row.page_no]);
  await query('UPDATE chapter_pages SET page_no = $2 WHERE id = $1', [id, neighborNo]);
  return NextResponse.json({ ok: true, moved: true });
}
