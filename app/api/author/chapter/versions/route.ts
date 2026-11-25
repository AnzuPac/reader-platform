import { NextResponse } from 'next/server';
import { initSchema, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { listVersions } from '@/lib/chapter-versions';

export async function GET(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('work') || '';
  const number = Number(url.searchParams.get('number'));
  if (!slug || !Number.isFinite(number)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || Number(work.author_id) !== Number(s.uid)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const chapter = await one<{ id: number }>('SELECT id FROM chapters WHERE work_id = $1 AND number = $2', [work.id, number]);
  if (!chapter) return NextResponse.json({ versions: [] });

  const rows = await listVersions(chapter.id, 30);
  return NextResponse.json({
    versions: rows.map((v) => ({
      id: v.id, title: v.title, word_count: v.word_count, source: v.source, created_at: v.created_at,
    })),
  });
}
