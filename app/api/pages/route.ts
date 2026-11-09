import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chapterId = Number(url.searchParams.get('chapter'));
  if (!chapterId) return NextResponse.json({ pages: [] });
  await initSchema();
  const ch = await one<{ work_id: number; number: number; title: string }>(
    'SELECT work_id, number, title FROM chapters WHERE id = $1', [chapterId]
  );
  if (!ch) return NextResponse.json({ pages: [] });
  const pages = await query<{ page_no: number; file_path: string }>(
    'SELECT page_no, file_path FROM chapter_pages WHERE chapter_id = $1 ORDER BY page_no', [chapterId]
  );
  return NextResponse.json({ pages, title: ch.title, number: ch.number });
}
