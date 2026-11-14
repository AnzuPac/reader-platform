import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { chapterGate } from '@/lib/purchases';

export const dynamic = 'force-dynamic';

/** Страницы комикса. Доступ проверяется так же, как у текста главы. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chapterId = Number(url.searchParams.get('chapter'));
  if (!chapterId) return NextResponse.json({ pages: [] });
  await initSchema();
  const ch = await one<{ work_id: number; number: number; title: string; access: string }>(
    'SELECT work_id, number, title, access FROM chapters WHERE id = $1', [chapterId]
  );
  if (!ch) return NextResponse.json({ pages: [] });

  const session = await readSession();
  const gate = await chapterGate({ id: chapterId, work_id: ch.work_id, access: ch.access }, session);
  if (!gate.allowed) {
    return NextResponse.json(
      { pages: [], locked: true, reason: gate.reason },
      { status: 403 }
    );
  }

  const pages = await query<{ page_no: number; file_path: string }>(
    'SELECT page_no, file_path FROM chapter_pages WHERE chapter_id = $1 ORDER BY page_no', [chapterId]
  );
  return NextResponse.json({ pages, title: ch.title, number: ch.number });
}
