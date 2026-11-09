import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { getWork } from '@/lib/repo';


function translit(s: string): string {
  const map: Record<string, string> = { 'š':'s','đ':'dj','č':'c','ć':'c','ž':'z','Š':'s','Đ':'dj','Č':'c','Ć':'c','Ž':'z' };
  return s.replace(/[šđčćžŠĐČĆŽ]/g, (c) => map[c] || c);
}

function slugify(s: string): string {
  s = translit(s);
  return s.toLowerCase().replace(/[^a-z0-9šđčćž]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'work';
}

/** Мои произведения автора */
export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const works = await query(
    `SELECT id, slug, title, status, completion, words_total, cover_path, updated_at
       FROM works WHERE author_id = $1 ORDER BY updated_at DESC`, [s.uid]
  );
  return NextResponse.json({ works });
}

/** Создать или обновить произведение (черновик) */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const title = String(b?.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  await initSchema();

  const slugInput = String(b?.slug || '').trim();
  if (slugInput) {
    const existing = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slugInput]);
    if (!existing || existing.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await query(
      `UPDATE works SET title = $2, description = $3, age_rating = $4, completion = $5, updated_at = now() WHERE id = $1`,
      [existing.id, title, String(b?.description || ''), Number(b?.ageRating) || 0, b?.completion === 'completed' ? 'completed' : 'ongoing']
    );
    return NextResponse.json({ ok: true, work: { id: existing.id, slug: slugInput } });
  }

  const slug = slugify(title);
  const rows = await query<{ id: number; slug: string }>(
    `INSERT INTO works (slug, author_id, original_language, status, completion, age_rating, title, description)
     VALUES ($1,$2,'sr','draft',$3,$4,$5,$6) RETURNING id, slug`,
    [slug, s.uid, b?.completion === 'completed' ? 'completed' : 'ongoing', Number(b?.ageRating) || 0, title, String(b?.description || '')]
  );
  return NextResponse.json({ ok: true, work: rows[0] });
}
