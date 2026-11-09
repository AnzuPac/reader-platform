import { query, one, initSchema } from './db';

export type WorkCard = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string;
};

export type ChapterRow = {
  id: number; number: number; title: string; access: string; word_count: number; published_at: string | null;
};

let ready = false;
async function ensure() { if (!ready) { await initSchema(); ready = true; } }

export async function listWorks(opts: { q?: string; limit?: number; offset?: number } = {}): Promise<WorkCard[]> {
  await ensure();
  const q = (opts.q || '').trim();
  const limit = Math.min(opts.limit ?? 24, 60);
  const offset = opts.offset ?? 0;
  const like = `%${q.toLowerCase()}%`;
  const sql = q
    ? `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
              w.age_rating, w.completion, u.display_name AS author_name
         FROM works w JOIN users u ON u.id = w.author_id
        WHERE w.status = 'published' AND (lower(w.title) LIKE $1 OR lower(u.display_name) LIKE $1)
        ORDER BY w.published_at DESC NULLS LAST LIMIT $2 OFFSET $3`
    : `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
              w.age_rating, w.completion, u.display_name AS author_name
         FROM works w JOIN users u ON u.id = w.author_id
        WHERE w.status = 'published'
        ORDER BY w.published_at DESC NULLS LAST LIMIT $1 OFFSET $2`;
  const params = q ? [like, limit, offset] : [limit, offset];
  return query<WorkCard>(sql, params);
}

export async function getWork(slug: string): Promise<WorkCard | null> {
  await ensure();
  return one<WorkCard>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.age_rating, w.completion, u.display_name AS author_name
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
  }>(
    `SELECT c.id, c.work_id, c.number, c.title, c.content, c.access, c.word_count,
            w.slug AS work_slug, w.title AS work_title
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
