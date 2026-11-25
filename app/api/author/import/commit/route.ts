import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { initSchema, one, query } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { countWords } from '@/lib/import-parse';

export const runtime = 'nodejs';

const ALLOWED = ['p','br','h1','h2','h3','strong','em','u','li','ul','ol','blockquote','hr','img'];
const ATTR = ['src','alt'];

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const workSlug = String(body?.workSlug || '').trim();
  const list = Array.isArray(body?.chapters) ? body.chapters.slice(0, 200) : [];
  if (!workSlug || !list.length) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [workSlug]);
  if (!work || Number(work.author_id) !== Number(s.uid)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const last = await one<{ max: number | string }>('SELECT COALESCE(MAX(number),0) AS max FROM chapters WHERE work_id = $1', [work.id]);
  let next = Number(last?.max || 0) + 1;
  let created = 0;

  for (const item of list) {
    const title = String(item?.title || '').slice(0, 200) || `Глава ${next}`;
    const html = DOMPurify.sanitize(String(item?.html || ''), { ALLOWED_TAGS: ALLOWED, ALLOWED_ATTR: ATTR });
    const words = countWords(html);
    if (!words) continue;
    await query(
      `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
       VALUES ($1,$2,$3,$4,$5,'free','draft')`,
      [work.id, next, title, html, words],
    );
    next += 1;
    created += 1;
  }

  await query('UPDATE works SET words_total = (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE work_id=$1) WHERE id=$1', [work.id]).catch(() => {});
  return NextResponse.json({ ok: true, created });
}
