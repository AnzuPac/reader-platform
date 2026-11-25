import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { getVersionForUser, saveVersion } from '@/lib/chapter-versions';

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const versionId = Number(b?.versionId);
  if (!Number.isFinite(versionId)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const version = await getVersionForUser(versionId, s.uid);
  if (!version) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (version.chapter_status === 'published') {
    return NextResponse.json({ error: 'published_needs_revision' }, { status: 409 });
  }

  const current = await one<{ title: string; content: string; word_count: number }>(
    'SELECT title, content, word_count FROM chapters WHERE id = $1', [version.chapter_id],
  );
  if (current?.content) {
    await saveVersion({
      chapterId: version.chapter_id, workId: version.work_id, userId: s.uid, number: version.number,
      title: current.title, content: current.content, wordCount: current.word_count || 0, source: 'before_restore',
    }).catch(() => {});
  }

  await query('UPDATE chapters SET title = $1, content = $2, word_count = $3 WHERE id = $4',
    [version.title, version.content, version.word_count || 0, version.chapter_id]);
  await query('UPDATE works SET words_total = (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE work_id=$1) WHERE id=$1', [version.work_id]).catch(() => {});

  return NextResponse.json({ ok: true, title: version.title, content: version.content });
}
