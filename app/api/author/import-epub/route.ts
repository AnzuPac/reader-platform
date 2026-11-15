import { NextResponse } from 'next/server';
import { requireAuthor } from '@/lib/author';
import { initSchema, one, query } from '@/lib/db';
import { parseEpub } from '@/lib/epub';
import { slugify } from '@/lib/slug';

export const runtime = 'nodejs';

/** POST /api/author/import-epub — импорт книги из EPUB (ТЗ 7.3). */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseEpub(buf);
  } catch (e) {
    const code = String((e as Error).message || 'parse_failed');
    return NextResponse.json({ error: code }, { status: 422 });
  }

  await initSchema();
  const base = slugify(parsed.title) || 'knjiga';
  let slug = base;
  for (let i = 2; i < 100; i += 1) {
    const taken = await one('SELECT id FROM works WHERE slug = $1', [slug]);
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const work = await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, title, description, status, completion, published_at)
     VALUES ($1,$2,'sr',$3,$4,'draft','completed',null) RETURNING id`,
    [slug, s.uid, parsed.title.slice(0, 200), `Uvezeno iz EPUB · glava: ${parsed.chapters.length}`]
  );
  if (!work) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

  let n = 0;
  for (const [i, ch] of parsed.chapters.entries()) {
    await query(
      `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
       VALUES ($1,$2,$3,$4,$5,'free','draft')`,
      [work.id, i + 1, ch.title.slice(0, 200), ch.html, ch.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length]
    );
    n += 1;
  }

  return NextResponse.json({ ok: true, work: { id: work.id, slug, title: parsed.title }, chapters: n, warnings: parsed.warnings });
}
