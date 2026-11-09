import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const workSlug = String(b?.workSlug || '').trim();
  const number = Number(b?.number);
  const raw = String(b?.content || '');
  if (!workSlug || !Number.isFinite(number)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['p','br','h1','h2','h3','strong','em','u','s','ul','ol','li','blockquote','hr','img','a','span'], ALLOWED_ATTR: ['src','href','alt','style','class'] });
  const words = plainText(clean).split(/\s+/).filter(Boolean).length;

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [workSlug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const access = ['free','subscribers','paid'].includes(String(b?.access)) ? String(b?.access) : 'free';
  const rows = await query<{ id: number; number: number }>(
    `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
     VALUES ($1,$2,$3,$4,$5,$6,'draft')
     ON CONFLICT (work_id, number) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
       word_count = EXCLUDED.word_count, access = EXCLUDED.access
     RETURNING id, number`,
    [work.id, number, String(b?.title || `Glava ${number}`), clean, words, access]
  );
  await query('UPDATE works SET words_total = (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE work_id=$1) WHERE id=$1', [work.id]);
  return NextResponse.json({ ok: true, chapter: rows[0], words });
}

export async function GET(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('work') || '';
  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const fullParam = url.searchParams.get('full');
  if (fullParam) {
    const one = await query<{ content: string; title: string; access: string }>(
      `SELECT content, title, access FROM chapters WHERE work_id = $1 AND number = $2`,
      [work.id, Number(fullParam)]
    );
    return NextResponse.json({ content: one[0]?.content || '', title: one[0]?.title || '', access: one[0]?.access || 'free' });
  }
  const rows = await query(
    `SELECT id, number, title, access, status, word_count, substr(content,1,120) AS preview
       FROM chapters WHERE work_id = $1 ORDER BY number`, [work.id]
  );
  return NextResponse.json({ chapters: rows });
}
