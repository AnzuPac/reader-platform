import { NextResponse } from 'next/server';
import { slugify } from '@/lib/slug';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { getWork } from '@/lib/repo';




/** Мои произведения автора */
export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  // Границы периода — строками в формате SQLite/ISO, чтобы работало и на PostgreSQL.
  const cut = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const cut7 = cut(7);
  const cut30 = cut(30);
  const works = await query(
    `SELECT w.id, w.slug, w.title, w.type, w.status, w.completion, w.words_total, w.cover_path, w.updated_at,
            w.views_total,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM chapters c WHERE c.work_id = w.id AND c.status = 'published') AS chapters,
            (SELECT CAST(COUNT(DISTINCT p.user_id) AS INTEGER) FROM reading_progress p WHERE p.work_id = w.id) AS readers,
            (SELECT CAST(COUNT(DISTINCT p.user_id) AS INTEGER) FROM reading_progress p
              WHERE p.work_id = w.id AND p.updated_at >= $2) AS readers7,
            (SELECT CAST(COUNT(DISTINCT p.user_id) AS INTEGER) FROM reading_progress p
              WHERE p.work_id = w.id AND p.updated_at >= $3) AS readers30,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM ratings r WHERE r.work_id = w.id) AS likes,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM bookmarks b JOIN chapters c ON c.id = b.chapter_id
              WHERE c.work_id = w.id) AS bookmarks
       FROM works w WHERE w.author_id = $1 ORDER BY w.updated_at DESC`, [s.uid, cut7, cut30]
  );
  return NextResponse.json({ works });
}

/** Создать или обновить произведение (nacrt) */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const title = String(b?.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  await initSchema();

  const rawAi = String(b?.aiUsage || 'not_declared');
  const aiUsage = (['not_declared','no_ai','assisted','generated'].includes(rawAi) ? rawAi : 'not_declared');
  const kind = b?.kind === 'fanfic' ? 'fanfic' : 'original';
  const isClassic = b?.isClassic === true || b?.isClassic === 1;
  const rightsConfirmed = b?.rightsConfirmed === true || b?.rightsConfirmed === 1;
  if (kind === 'original' && !isClassic && !rightsConfirmed) return NextResponse.json({ error: 'rights_confirmation_required' }, { status: 400 });
  const slugInput = String(b?.slug || '').trim();
  if (slugInput) {
    const existing = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slugInput]);
    if (!existing || Number(existing.author_id) !== Number(s.uid)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await query(
      `UPDATE works SET title = $2, description = $3, age_rating = $4, completion = $5, ai_usage = $6, kind = $7, is_classic = $8, rights_confirmed = $9, updated_at = now() WHERE id = $1`,
      [existing.id, title, String(b?.description || ''), Number(b?.ageRating) || 0, b?.completion === 'completed' ? 'completed' : 'ongoing', aiUsage, kind, isClassic, rightsConfirmed]
    );
    if (kind === 'fanfic' || isClassic) {
      await query("UPDATE chapters SET access = 'free', price_cents = 0 WHERE work_id = $1 AND access = 'paid'", [existing.id]);
      await query('UPDATE chapter_prices SET active = 0 WHERE chapter_id IN (SELECT id FROM chapters WHERE work_id = $1)', [existing.id]);
      await query('UPDATE book_prices SET active = 0 WHERE work_id = $1', [existing.id]);
    }
    return NextResponse.json({ ok: true, work: { id: existing.id, slug: slugInput } });
  }

  const slug = slugify(title);
  const wtype = b?.type === 'comic' ? 'comic' : 'novel';
  const rows = await query<{ id: number; slug: string }>(
    `INSERT INTO works (slug, author_id, original_language, status, completion, age_rating, title, description, type, kind, is_classic, rights_confirmed, ai_usage)
     VALUES ($1,$2,'sr','draft',$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, slug`,
    [slug, s.uid, b?.completion === 'completed' ? 'completed' : 'ongoing', Number(b?.ageRating) || 0, title, String(b?.description || ''), wtype, kind, isClassic, rightsConfirmed, aiUsage]
  );
  return NextResponse.json({ ok: true, work: rows[0] });
}
