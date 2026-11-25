import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { initSchema, one, query } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { saveVersion } from '@/lib/chapter-versions';

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const rl = await rateLimit(clientKey(req, `autosave:${s.uid}`), 240, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });

  const b = await req.json().catch(() => null);
  const workSlug = String(b?.workSlug || '').trim();
  const number = Number(b?.number);
  const raw = String(b?.content || '');
  if (!workSlug || !Number.isFinite(number) || number < 1) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  await initSchema();
  const work = await one<{ id: number; author_id: number }>(
    'SELECT id, author_id FROM works WHERE slug = $1', [workSlug],
  );
  if (!work || Number(work.author_id) !== Number(s.uid)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p','br','h1','h2','h3','strong','em','u','s','ul','ol','li','blockquote','hr','img','a','span','div'],
    ALLOWED_ATTR: ['src','href','alt','style','class'],
  });
  const words = plainText(clean).split(/\s+/).filter(Boolean).length;
  const title = String(b?.title || '').slice(0, 300);

  const chapter = await one<{ id: number; status: string }>(
    'SELECT id, status FROM chapters WHERE work_id = $1 AND number = $2', [work.id, number],
  );

  let chapterId: number;
  if (!chapter) {
    const rows = await query<{ id: number }>(
      `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
       VALUES ($1,$2,$3,$4,$5,'free','draft') RETURNING id`,
      [work.id, number, title || `Glava ${number}`, clean, words],
    );
    chapterId = rows[0].id;
  } else {
    chapterId = chapter.id;
    if (chapter.status !== 'published') {
      await query(
        'UPDATE chapters SET title = $1, content = $2, word_count = $3 WHERE id = $4',
        [title || `Glava ${number}`, clean, words, chapterId],
      );
    }
  }

  const version = await saveVersion({
    chapterId, workId: work.id, userId: s.uid, number,
    title: title || `Glava ${number}`, content: clean, wordCount: words, source: 'autosave',
  });
  await query('UPDATE works SET words_total = (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE work_id=$1) WHERE id=$1', [work.id]).catch(() => {});

  return NextResponse.json({
    ok: true,
    mode: chapter?.status === 'published' ? 'version_only' : 'saved',
    chapterId, versionId: version.versionId, skipped: version.skipped,
    savedAt: new Date().toISOString(), words,
  });
}
