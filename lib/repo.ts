import { query, one, initSchema } from './db';

export type WorkCard = {
  id: number; slug: string; title: string; description: string; cover_path: string | null;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string;
};

export type ChapterRow = {
  id: number; number: number; title: string; access: string; word_count: number; published_at: string | null;
};

let ready = false;
async function ensure() { if (!ready) { await initSchema(); ready = true; } }

export async function listWorks(opts: { q?: string; genre?: string; limit?: number; offset?: number } = {}): Promise<WorkCard[]> {
  await ensure();
  const q = (opts.q || '').trim();
  const genre = (opts.genre || '').trim();
  const limit = Math.min(opts.limit ?? 24, 60);
  const offset = opts.offset ?? 0;
  const params: unknown[] = [];
  const where: string[] = ["w.status = 'published'"];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(lower(w.title) LIKE $${params.length} OR lower(u.display_name) LIKE $${params.length})`);
  }
  if (genre) {
    params.push(genre);
    where.push(`EXISTS (SELECT 1 FROM work_genres wg JOIN genres g ON g.id = wg.genre_id
                        WHERE wg.work_id = w.id AND g.slug = $${params.length})`);
  }
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const sql = `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
                      w.age_rating, w.completion, w.cover_path, u.display_name AS author_name
                 FROM works w JOIN users u ON u.id = w.author_id
                WHERE ${where.join(' AND ')}
                ORDER BY w.published_at DESC NULLS LAST LIMIT $${limIdx} OFFSET $${offIdx}`;
  return query<WorkCard>(sql, params);
}

export async function getWork(slug: string): Promise<WorkCard | null> {
  await ensure();
  return one<WorkCard>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.age_rating, w.completion, w.cover_path, u.display_name AS author_name
       FROM works w JOIN users u ON u.id = w.author_id
      WHERE w.slug = $1 AND w.status = 'published'`, [slug]
  );
}

export async function listChapters(workId: number): Promise<ChapterRow[]> {
  await ensure();
  return query<ChapterRow>(
    `SELECT id, number, title, access, word_count, published_at
       FROM chapters WHERE work_id = $1 AND status = 'published' ORDER BY number`, [workId]
  );
}

export async function getChapter(id: number) {
  await ensure();
  return one<{
    id: number; work_id: number; number: number; title: string; content: string;
    access: string; word_count: number; work_slug: string; work_title: string;
    font_family: string | null; font_path: string | null;
  }>(
    `SELECT c.id, c.work_id, c.number, c.title, c.content, c.access, c.word_count,
            w.slug AS work_slug, w.title AS work_title, w.font_family, w.font_path
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1 AND c.status = 'published'`, [id]
  );
}

export async function saveProgress(userId: number, workId: number, chapterId: number, position: number, percent: number) {
  await ensure();
  await query(
    `INSERT INTO reading_progress (user_id, work_id, chapter_id, position, percent, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (user_id, work_id)
     DO UPDATE SET chapter_id = EXCLUDED.chapter_id, position = EXCLUDED.position,
                   percent = EXCLUDED.percent, updated_at = now()`,
    [userId, workId, chapterId, position, percent]
  );
}

export async function isInLibrary(userId: number, workId: number): Promise<boolean> {
  await ensure();
  const rows = await query<{ ok: number }>(
    'SELECT 1 AS ok FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId]
  );
  return rows.length > 0;
}

export async function toggleLibrary(userId: number, workId: number): Promise<boolean> {
  await ensure();
  const exists = await isInLibrary(userId, workId);
  if (exists) {
    await query('DELETE FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId]);
    return false;
  }
  await query('INSERT INTO library_items (user_id, work_id) VALUES ($1,$2)', [userId, workId]);
  return true;
}

export async function listLibrary(userId: number) {
  await ensure();
  return query<WorkCard & { added_at: string }>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.age_rating, w.completion, w.cover_path, u.display_name AS author_name, l.created_at AS added_at
       FROM library_items l
       JOIN works w ON w.id = l.work_id
       JOIN users u ON u.id = w.author_id
      WHERE l.user_id = $1 AND w.status = 'published'
      ORDER BY l.created_at DESC`, [userId]
  );
}

export async function listGenres() {
  await ensure();
  return query<{ id: number; slug: string; name_sr: string; name_en: string; name_ru: string }>(
    'SELECT id, slug, name_sr, name_en, name_ru FROM genres ORDER BY id'
  );
}

export async function workGenres(workId: number) {
  await ensure();
  return query<{ slug: string; name_sr: string; name_en: string; name_ru: string }>(
    `SELECT g.slug, g.name_sr, g.name_en, g.name_ru
       FROM work_genres wg JOIN genres g ON g.id = wg.genre_id
      WHERE wg.work_id = $1`, [workId]
  );
}

export async function addWorkGenre(workId: number, genreSlug: string): Promise<void> {
  await ensure();
  const g = await one<{ id: number }>('SELECT id FROM genres WHERE slug = $1', [genreSlug]);
  if (!g) return;
  await query('INSERT INTO work_genres (work_id, genre_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [workId, g.id]);
}

export async function getAuthorWork(slug: string, authorId: number) {
  await ensure();
  return one<{ id: number; slug: string; title: string; status: string; cover_path: string | null }>(
    'SELECT id, slug, title, status, cover_path FROM works WHERE slug = $1 AND author_id = $2', [slug, authorId]
  );
}

export async function getContinueReading(userId: number) {
  await ensure();
  return one<{ work_slug: string; work_title: string; chapter_id: number; chapter_title: string; number: number; percent: number }>(
    `SELECT w.slug AS work_slug, w.title AS work_title, c.id AS chapter_id,
            c.title AS chapter_title, c.number, p.percent
       FROM reading_progress p
       JOIN works w ON w.id = p.work_id
       JOIN chapters c ON c.id = p.chapter_id
      WHERE p.user_id = $1 AND w.status = 'published'
      ORDER BY p.updated_at DESC LIMIT 1`, [userId]
  );
}
