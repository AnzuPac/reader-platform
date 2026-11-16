import { normalizeSr } from './sr';
import { query, one, initSchema } from './db';
import {
  backfillSearchNorm, searchTokens, TRANSLIT_ALLOWED_SQL, PARAGRAPH_COMMENTS_SQL,
} from './search';

export type WorkCard = {
  id: number; slug: string; title: string; description: string; cover_path: string | null;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string; type?: string; kind?: string; category?: string;
  is_classic?: number; publisher_id?: number | null;
};

export type ChapterRow = {
  id: number; number: number; title: string; access: string; price_cents: number;
  word_count: number; published_at: string | null;
};

let ready = false;
async function ensure() { if (!ready) { await initSchema(); ready = true; } }

export type ListWorksOpts = {
  q?: string; genre?: string; type?: string; sort?: string; limit?: number; offset?: number;
  /** Тип издания: издательская, самиздат, фанфик, классика (ТЗ 4.4). */
  source?: string;
  free?: boolean; subscribed?: boolean; classic?: boolean; fanfic?: boolean;
  completion?: string;
  tag?: string;
  excludeTags?: string[];
};

export async function listWorks(opts: ListWorksOpts = {}): Promise<WorkCard[]> {
  await ensure();
  const q = (opts.q || '').trim();
  const genre = (opts.genre || '').trim();
  const wtype = (opts.type || '').trim();
  const source = (opts.source || '').trim();
  const completion = (opts.completion || '').trim();
  const tag = (opts.tag || '').trim();
  const excludeTags = (opts.excludeTags || []).map((t) => t.trim()).filter(Boolean);
  const sort = (opts.sort || 'new').trim();
  const limit = Math.min(opts.limit ?? 24, 60);
  const offset = opts.offset ?? 0;
  const params: unknown[] = [];
  const where: string[] = ["w.status = 'published'"];
  if (q) {
    // Старые строки могли не иметь ключа — дозаполняем перед поиском.
    await backfillSearchNorm();
    const tokens = searchTokens(q);
    for (const token of tokens) {
      params.push(`%${token}%`);
      where.push(`w.search_norm LIKE $${params.length}`);
    }
  }
  if (opts.classic) where.push('w.is_classic = 1');
  if (opts.fanfic === true) where.push("w.kind = 'fanfic'");
  if (opts.fanfic === false) where.push("w.kind = 'original'");
  if (wtype === 'novel' || wtype === 'comic') {
    params.push(wtype);
    where.push(`w.type = $${params.length}`);
  }
  if (source === 'publisher') where.push('w.publisher_id IS NOT NULL');
  if (source === 'selfpub') where.push("w.publisher_id IS NULL AND w.kind <> 'fanfic' AND w.is_classic = 0");
  if (source === 'fanfic') where.push("w.kind = 'fanfic'");
  if (source === 'classic') where.push('w.is_classic = 1');
  if (opts.free) {
    where.push(`EXISTS (SELECT 1 FROM chapters c WHERE c.work_id = w.id
                         AND c.status = 'published' AND c.access = 'free')`);
  }
  if (opts.subscribed) {
    where.push(`EXISTS (SELECT 1 FROM chapters c WHERE c.work_id = w.id
                         AND c.status = 'published' AND c.access = 'subscribers')`);
  }
  if (completion === 'completed' || completion === 'ongoing') {
    params.push(completion);
    where.push(`w.completion = $${params.length}`);
  }
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (SELECT 1 FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
                        WHERE wt.work_id = w.id AND t.slug = $${params.length})`);
  }
  if (excludeTags.length) {
    const placeholders = excludeTags.map((t) => { params.push(t); return `$${params.length}`; });
    where.push(`NOT EXISTS (SELECT 1 FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
                             WHERE wt.work_id = w.id AND t.slug IN (${placeholders.join(',')}))`);
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
  const order =
    sort === 'rating' ? 'w.rating_avg DESC, w.ratings_count DESC' :
    sort === 'views' ? 'w.views_total DESC' :
    sort === 'words' ? 'w.words_total DESC' :
    'w.published_at DESC NULLS LAST';
  const sql = `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
                 w.age_rating, w.completion, w.cover_path, w.type, w.kind,
                 CASE WHEN w.kind = 'fanfic' THEN 'fanfic' WHEN w.type = 'comic' THEN 'manga' ELSE 'book' END AS category,
                 w.is_classic, w.publisher_id, u.display_name AS author_name
                 FROM works w JOIN users u ON u.id = w.author_id
                WHERE ${where.join(' AND ')}
                ORDER BY ${order} LIMIT $${limIdx} OFFSET $${offIdx}`;
  return query<WorkCard>(sql, params);
}

export async function getWork(slug: string): Promise<(WorkCard & { type: string; author_id: number }) | null> {
  await ensure();
  return one<WorkCard & { type: string; author_id: number }>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.age_rating, w.completion, w.cover_path, w.type, w.kind, CASE WHEN w.kind = 'fanfic' THEN 'fanfic' WHEN w.type = 'comic' THEN 'manga' ELSE 'book' END AS category, w.author_id, u.display_name AS author_name
       FROM works w JOIN users u ON u.id = w.author_id
      WHERE w.slug = $1 AND w.status = 'published'`, [slug]
  );
}

export async function listChapters(workId: number): Promise<ChapterRow[]> {
  await ensure();
  return query<ChapterRow>(
    `SELECT id, number, title, access, price_cents, word_count, published_at
       FROM chapters WHERE work_id = $1 AND status = 'published' ORDER BY number`, [workId]
  );
}

export async function getChapter(id: number) {
  await ensure();
  return one<{
    id: number; work_id: number; number: number; title: string; content: string;
    access: string; price_cents: number; word_count: number; work_slug: string; work_title: string;
    font_family: string | null; font_path: string | null; work_type: string;
    translit_allowed: number; paragraph_comments_enabled: number;
  }>(
    `SELECT c.id, c.work_id, c.number, c.title, c.content, c.access, c.price_cents, c.word_count,
            w.slug AS work_slug, w.title AS work_title, w.font_family, w.font_path, w.type AS work_type,
            ${TRANSLIT_ALLOWED_SQL} AS translit_allowed,
            ${PARAGRAPH_COMMENTS_SQL} AS paragraph_comments_enabled
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
  return one<{ id: number; slug: string; title: string; description: string; status: string; cover_path: string | null; age_rating: number; completion: string; type: string }>(
    'SELECT id, slug, title, description, status, cover_path, age_rating, completion, type FROM works WHERE slug = $1 AND author_id = $2', [slug, authorId]
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
