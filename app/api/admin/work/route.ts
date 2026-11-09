import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk, ensureAuthor } from '@/lib/admin';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9а-яёšđčćž]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'work';
}

export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const title = String(b?.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  await initSchema();
  const authorId = await ensureAuthor();
  const slug = String(b?.slug || slugify(title));
  const rows = await query<{ id: number; slug: string }>(
    `INSERT INTO works (slug, author_id, original_language, status, completion, age_rating, title, description, published_at)
     VALUES ($1,$2,'sr','published',$3,$4,$5,$6, now())
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
     RETURNING id, slug`,
    [slug, authorId, b?.completion === 'completed' ? 'completed' : 'ongoing', Number(b?.ageRating) || 0, title, String(b?.description || '')]
  );
  return NextResponse.json({ ok: true, work: rows[0] });
}

export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const rows = await query(
    `SELECT id, slug, title, description, status, completion, age_rating, words_total, published_at
       FROM works ORDER BY id DESC LIMIT 100`
  );
  return NextResponse.json({ works: rows });
}
