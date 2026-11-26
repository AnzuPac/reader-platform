import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { initSchema, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { chapterGate } from '@/lib/purchases';
import { imageContentType, resolveComicPath } from '@/lib/comic-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Защищённая выдача страницы комикса: доступ проверяется тем же chapterGate. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chapterId = Number(url.searchParams.get('chapter'));
  const pageNo = Number(url.searchParams.get('page'));
  if (!Number.isFinite(chapterId) || !Number.isFinite(pageNo) || chapterId <= 0 || pageNo <= 0) {
    return new NextResponse('bad_request', { status: 400 });
  }

  await initSchema();
  const ch = await one<{ id: number; work_id: number; access: string }>(
    'SELECT id, work_id, access FROM chapters WHERE id = $1', [chapterId],
  );
  if (!ch) return new NextResponse('not_found', { status: 404 });

  const session = await readSession();
  const gate = await chapterGate(ch, session);
  if (!gate.allowed) return new NextResponse('locked', { status: 403 });

  const page = await one<{ file_path: string }>(
    'SELECT file_path FROM chapter_pages WHERE chapter_id = $1 AND page_no = $2', [chapterId, pageNo],
  );
  if (!page) return new NextResponse('not_found', { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(resolveComicPath(page.file_path));
  } catch {
    return new NextResponse('not_found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': imageContentType(page.file_path),
      'Content-Length': String(data.length),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
