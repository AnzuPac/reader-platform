import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

export async function GET(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('work') || '';
  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const rows = await query(
    'SELECT id, lang, term, translation FROM glossary_terms WHERE work_id = $1 ORDER BY lang, term', [work.id]
  );
  return NextResponse.json({ terms: rows });
}

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const slug = String(b?.workSlug || '').trim();
  const lang = String(b?.lang || '');
  const term = String(b?.term || '').trim();
  const translation = String(b?.translation || '').trim();
  if (!slug || !['sr','en','ru'].includes(lang) || !term || !translation) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await query(
    `INSERT INTO glossary_terms (work_id, lang, term, translation) VALUES ($1,$2,$3,$4)
     ON CONFLICT (work_id, lang, term) DO UPDATE SET translation = EXCLUDED.translation`,
    [work.id, lang, term, translation]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await initSchema();
  await query(
    `DELETE FROM glossary_terms WHERE id = $1 AND work_id IN (SELECT id FROM works WHERE author_id = $2)`, [id, s.uid]
  );
  return NextResponse.json({ ok: true });
}
