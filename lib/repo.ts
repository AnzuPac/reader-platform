import { normalizeSr } from './sr';
import { query, one, initSchema } from './db';
import {
  backfillSearchNorm, searchTokens, TRANSLIT_ALLOWED_SQL, PARAGRAPH_COMMENTS_SQL,
} from './search';

export type WorkCard = {
  id: number; slug: string; title: string; description: string; cover_path: string | null;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string; type?: string; kind?: string; category?: string;
  is_classic?: number; publisher_id?: number | null; ai_usage?: 'not_declared' | 'no_ai' | 'assisted' | 'generated';
  /** Таксономия фанфиков/комиксов (аудит, п.29-30). */
  fandom?: string | null; pairing?: string | null; content_warnings?: string | null;
  comic_format?: string | null; reading_direction?: string | null;
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
  /** Подстрочный поиск по полю works.fandom (мастер-промпт §4: фандом). */
  fandom?: string;
  excludeTags?: string[];
  includeTags?: string[];
  /** Include-режим: все выбранные теги (AND) или любой (OR). */
  includeMode?: 'all' | 'any';
  aiUsage?: 'yes' | 'no_ai' | 'assisted' | 'generated';
  /** Несколько AI-статусов: used = assisted+generated; no_ai; not_declared. */
  aiUsages?: Array<'used' | 'no_ai' | 'not_declared' | 'assisted' | 'generated'>;
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
  // Потолок поднят до 100: страница каталога просит больше, чем 60,
  // и раньше молча обрезалась (см. аудит, п.5). Пагинация — offset/limit.
  const limit = Math.max(1, Math.min(opts.limit ?? 24, 100));
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
  if (opts.classic) where.push('w.is_classic = TRUE');
  const aiStatuses = new Set<string>();
  for (const value of opts.aiUsages || []) {
    if (value === 'used' || value === 'assisted' || value === 'generated') {
      aiStatuses.add('assisted'); aiStatuses.add('generated');
    } else if (value === 'no_ai') aiStatuses.add('no_ai');
    else if (value === 'not_declared') aiStatuses.add('not_declared');
  }
  if (opts.aiUsage === 'yes') { aiStatuses.add('assisted'); aiStatuses.add('generated'); }
  else if (opts.aiUsage) aiStatuses.add(opts.aiUsage);
  if (aiStatuses.size) {
    const list = Array.from(aiStatuses);
    const ph = list.map((v) => { params.push(v); return `$${params.length}`; });
    where.push(`w.ai_usage IN (${ph.join(',')})`);
  }
  if (opts.fanfic === true) where.push("w.kind = 'fanfic'");
  if (opts.fanfic === false) where.push("w.kind = 'original'");
  if (wtype === 'novel' || wtype === 'comic') {
    params.push(wtype);
    where.push(`w.type = $${params.length}`);
  }
  if (source === 'publisher') where.push('w.publisher_id IS NOT NULL');
  if (source === 'selfpub') where.push("w.publisher_id IS NULL AND w.kind <> 'fanfic' AND w.is_classic = FALSE");
  if (source === 'fanfic') where.push("w.kind = 'fanfic'");
  if (source === 'classic') where.push('w.is_classic = TRUE');
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
  if (opts.fandom?.trim()) {
    // ILIKE есть только в Postgres; LOWER(...) LIKE LOWER(...) работает в обоих.
    params.push(`%${opts.fandom.trim()}%`);
    where.push(`LOWER(COALESCE(w.fandom, '')) LIKE LOWER($${params.length})`);
  }
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (SELECT 1 FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
                        WHERE wt.work_id = w.id AND t.slug = $${params.length})`);
  }
  const includeTags = (opts.includeTags || []).map((t) => t.trim()).filter(Boolean);
  if (includeTags.length) {
    if ((opts.includeMode || 'all') === 'any') {
      const placeholders = includeTags.map((t) => { params.push(t); return `$${params.length}`; });
      where.push(`EXISTS (SELECT 1 FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
                          WHERE wt.work_id = w.id AND t.slug IN (${placeholders.join(',')}))`);
    } else {
      for (const slug of includeTags) {
        params.push(slug);
        where.push(`EXISTS (SELECT 1 FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
                            WHERE wt.work_id = w.id AND t.slug = $${params.length})`);
      }
    }
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
                 w.is_classic, w.publisher_id, w.ai_usage, u.display_name AS author_name
                 FROM works w JOIN users u ON u.id = w.author_id
                WHERE ${where.join(' AND ')}
                ORDER BY ${order} LIMIT $${limIdx} OFFSET $${offIdx}`;
  return query<WorkCard>(sql, params);
}

export async function getWork(slug: string): Promise<(WorkCard & { type: string; author_id: number }) | null> {
  await ensure();
  return one<WorkCard & { type: string; author_id: number }>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.fandom, w.pairing, w.content_warnings, w.comic_format, w.reading_direction,
            w.age_rating, w.completion, w.cover_path, w.type, w.kind, w.ai_usage, CASE WHEN w.kind = 'fanfic' THEN 'fanfic' WHEN w.type = 'comic' THEN 'manga' ELSE 'book' END AS category, w.author_id, u.display_name AS author_name
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
    tts_allowed: number;
  }>(
    `SELECT c.id, c.work_id, c.number, c.title, c.content, c.access, c.price_cents, c.word_count,
            w.slug AS work_slug, w.title AS work_title, w.font_family, w.font_path, w.type AS work_type,
            w.tts_allowed,
            ${TRANSLIT_ALLOWED_SQL} AS translit_allowed,
            ${PARAGRAPH_COMMENTS_SQL} AS paragraph_comments_enabled
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1 AND c.status = 'published'`, [id]
  );
}

export async function saveProgress(userId: number, workId: number, chapterId: number, position: number, percent: number) {
  await ensure();
  // Глава обязана принадлежать произведению: иначе прогресс можно записать
  // на чужую/несуществующую пару work+chapter (аудит, п.16).
  const ok = await query<{ ok: number }>(
    "SELECT 1 AS ok FROM chapters WHERE id = $1 AND work_id = $2",
    [chapterId, workId]
  );
  if (ok.length === 0) return false;
  await query(
    `INSERT INTO reading_progress (user_id, work_id, chapter_id, position, percent, updated_at)
     VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (user_id, work_id)
     DO UPDATE SET chapter_id = EXCLUDED.chapter_id, position = EXCLUDED.position,
                   percent = EXCLUDED.percent, updated_at = now()`,
    [userId, workId, chapterId, position, percent]
  );
  return true;
}

export async function isInLibrary(userId: number, workId: number): Promise<boolean> {
  await ensure();
  const rows = await query<{ ok: number }>(
    'SELECT 1 AS ok FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId]
  );
  return rows.length > 0;
}

export type LibraryStatus = 'want' | 'reading' | 'done' | 'favorite' | 'postponed' | 'dropped';
export const LIBRARY_STATUSES: LibraryStatus[] = ['reading', 'want', 'done', 'favorite', 'postponed', 'dropped'];

export function isLibraryStatus(v: unknown): v is LibraryStatus {
  return typeof v === 'string' && (LIBRARY_STATUSES as string[]).includes(v);
}

/** Добавить/снять «в библиотеке» (старое поведение кнопки на карточке). */
export async function toggleLibrary(userId: number, workId: number): Promise<boolean> {
  await ensure();
  const exists = await isInLibrary(userId, workId);
  if (exists) {
    await query('DELETE FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId]);
    return false;
  }
  await query("INSERT INTO library_items (user_id, work_id, status) VALUES ($1,$2,'want')", [userId, workId]);
  return true;
}

/** Поставить статус чтения. 'remove' убирает из библиотеки совсем. */
export async function setLibraryStatus(
  userId: number, workId: number, status: LibraryStatus | 'remove',
): Promise<LibraryStatus | null> {
  await ensure();
  if (status === 'remove') {
    await query('DELETE FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId]);
    return null;
  }
  await query(
    `INSERT INTO library_items (user_id, work_id, status, updated_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, work_id)
     DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    [userId, workId, status, new Date().toISOString()],
  );
  return status;
}

export async function getLibraryStatus(userId: number, workId: number): Promise<LibraryStatus | null> {
  await ensure();
  const row = await one<{ status: string | null }>(
    'SELECT status FROM library_items WHERE user_id = $1 AND work_id = $2', [userId, workId],
  );
  return isLibraryStatus(row?.status) ? row!.status : (row ? 'want' : null);
}

/** Счётчики по статусам — для вкладок «Моей полки». */
export async function libraryCounts(userId: number): Promise<Record<LibraryStatus, number>> {
  await ensure();
  const rows = await query<{ status: string | null; n: number | string }>(
    'SELECT status, COUNT(*) AS n FROM library_items WHERE user_id = $1 GROUP BY status', [userId],
  );
  const out = Object.fromEntries(LIBRARY_STATUSES.map((s) => [s, 0])) as Record<LibraryStatus, number>;
  for (const r of rows) {
    const key: LibraryStatus = isLibraryStatus(r.status) ? r.status : 'want';
    out[key] += Number(r.n) || 0;
  }
  return out;
}

export async function listLibrary(userId: number, status?: LibraryStatus) {
  await ensure();
  const params: unknown[] = [userId];
  let filter = '';
  if (status) { params.push(status); filter = ` AND coalesce(l.status, 'want') = $${params.length}`; }
  return query<WorkCard & { added_at: string; status: string | null }>(
    `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
            w.age_rating, w.completion, w.cover_path, w.type, w.kind, w.ai_usage,
            CASE WHEN w.kind = 'fanfic' THEN 'fanfic' WHEN w.type = 'comic' THEN 'manga' ELSE 'book' END AS category,
            u.display_name AS author_name, l.created_at AS added_at, l.status
       FROM library_items l
       JOIN works w ON w.id = l.work_id
       JOIN users u ON u.id = w.author_id
      WHERE l.user_id = $1 AND w.status = 'published'${filter}
      ORDER BY coalesce(l.updated_at, l.created_at) DESC`, params
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
  return one<{ id: number; slug: string; title: string; description: string; status: string; cover_path: string | null; age_rating: number; completion: string; type: string; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number; ai_usage: 'not_declared'|'no_ai'|'assisted'|'generated' }>(
    'SELECT id, slug, title, description, status, cover_path, age_rating, completion, type, kind, is_classic, rights_confirmed, ai_usage FROM works WHERE slug = $1 AND author_id = $2', [slug, authorId]
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

/** История чтения: всё, где есть прогресс, свежие сверху (аудит, п.21). */
export async function listReadingHistory(userId: number, limit = 50) {
  await ensure();
  return query<{
    work_id: number; slug: string; title: string; author_name: string; cover_path: string | null;
    chapter_id: number; chapter_title: string | null; number: number; percent: number; updated_at: string;
  }>(
    `SELECT w.id AS work_id, w.slug, w.title, w.cover_path, u.display_name AS author_name,
            c.id AS chapter_id, c.title AS chapter_title, c.number, p.percent, p.updated_at
       FROM reading_progress p
       JOIN works w ON w.id = p.work_id AND w.status = 'published'
       JOIN users u ON u.id = w.author_id
       LEFT JOIN chapters c ON c.id = p.chapter_id
      WHERE p.user_id = $1
      ORDER BY p.updated_at DESC LIMIT $2`,
    [userId, limit],
  );
}

/** Закладки по главам (таблица bookmarks была, но UI её не показывал). */
export async function listBookmarks(userId: number, limit = 50) {
  await ensure();
  return query<{
    id: number; chapter_id: number; position: number; note: string | null; created_at: string;
    slug: string; title: string; chapter_title: string | null; number: number;
  }>(
    `SELECT b.id, b.chapter_id, b.position, b.note, b.created_at,
            w.slug, w.title, c.title AS chapter_title, c.number
       FROM bookmarks b
       JOIN chapters c ON c.id = b.chapter_id
       JOIN works w ON w.id = c.work_id AND w.status = 'published'
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC LIMIT $2`,
    [userId, limit],
  );
}

export async function addBookmark(userId: number, chapterId: number, position: number, note: string | null) {
  await ensure();
  const rows = await query<{ id: number }>(
    'INSERT INTO bookmarks (user_id, chapter_id, position, note) VALUES ($1,$2,$3,$4) RETURNING id',
    [userId, chapterId, position, note],
  );
  return rows[0]?.id ?? null;
}

export async function deleteBookmark(userId: number, id: number) {
  await ensure();
  await query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);
}

/** Похожие произведения: те же жанры, кроме самого произведения (аудит, п.25). */
export async function listRelatedWorks(workId: number, limit = 4) {
  await ensure();
  return query<{ id: number; slug: string; title: string; author_name: string; cover_path: string | null; rating_avg: string }>(
    `SELECT w.id, w.slug, w.title, u.display_name AS author_name, w.cover_path, w.rating_avg
       FROM works w
       JOIN users u ON u.id = w.author_id
      WHERE w.status = 'published' AND w.id <> $1
        AND EXISTS (
          SELECT 1 FROM work_genres wg
           WHERE wg.work_id = w.id
             AND wg.genre_id IN (SELECT genre_id FROM work_genres WHERE work_id = $1)
        )
      ORDER BY w.rating_avg DESC, w.published_at DESC
      LIMIT $2`,
    [workId, limit],
  );
}

/** Прогресс чтения по произведениям — для полосок на карточках каталога (аудит, п.28). */
export async function progressByWork(userId: number): Promise<Record<number, number>> {
  await ensure();
  const rows = await query<{ work_id: number; percent: number }>(
    'SELECT work_id, percent FROM reading_progress WHERE user_id = $1',
    [userId],
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[Number(r.work_id)] = Number(r.percent) || 0;
  return out;
}

/** Новые главы в произведениях из библиотеки — лента уведомлений (аудит, п.22). */
export async function listLibraryUpdates(userId: number, days = 45, limit = 30) {
  await ensure();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return query<{
    chapter_id: number; chapter_title: string | null; number: number; published_at: string;
    slug: string; title: string; author_name: string;
  }>(
    `SELECT c.id AS chapter_id, c.title AS chapter_title, c.number, c.published_at,
            w.slug, w.title, u.display_name AS author_name
       FROM library_items li
       JOIN works w ON w.id = li.work_id AND w.status = 'published'
       JOIN users u ON u.id = w.author_id
       JOIN chapters c ON c.work_id = w.id AND c.status = 'published'
      WHERE li.user_id = $1 AND c.published_at IS NOT NULL AND c.published_at >= $2
      ORDER BY c.published_at DESC
      LIMIT $3`,
    [userId, since, limit],
  );
}

/** Количество новых глав для бейджа в шапке. */
export async function countLibraryUpdates(userId: number, days = 7): Promise<number> {
  await ensure();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n
       FROM library_items li
       JOIN works w ON w.id = li.work_id AND w.status = 'published'
       JOIN chapters c ON c.work_id = w.id AND c.status = 'published'
      WHERE li.user_id = $1 AND c.published_at IS NOT NULL AND c.published_at >= $2`,
    [userId, since],
  );
  return Number(rows[0]?.n ?? 0);
}

/* ───────────── Топы по периодам ───────────── */

export type TopPeriod = 'all' | 'year' | 'month' | 'week';
export type TopCategory = 'publisher' | 'selfpub' | 'fanfic' | 'graphic';

const TOP_CATEGORY_SQL: Record<TopCategory, string> = {
  publisher: "w.publisher_id IS NOT NULL AND w.kind <> 'fanfic'",
  selfpub: "w.publisher_id IS NULL AND w.kind <> 'fanfic' AND w.is_classic = FALSE",
  fanfic: "w.kind = 'fanfic'",
  graphic: "w.type = 'comic'",
};

/** Просмотр произведения: пишем событие для топов по периодам.
 *  Ошибка статистики не должна ломать страницу. */
export async function recordWorkView(workId: number): Promise<void> {
  await ensure();
  try {
    await query('INSERT INTO work_views (work_id) VALUES ($1)', [workId]);
  } catch { /* ignore */ }
}

/** Топ произведений категории за период.
 *  «Всё время» — по суммарному счётчику; год/месяц/неделя — по событиям work_views. */
export async function listTopWorks(opts: {
  period?: TopPeriod; category?: TopCategory; limit?: number;
} = {}): Promise<WorkCard[]> {
  await ensure();
  const period = opts.period || 'all';
  const category = opts.category || 'publisher';
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
  const cat = TOP_CATEGORY_SQL[category];

  const base = `SELECT w.id, w.slug, w.title, w.description, w.rating_avg, w.words_total, w.views_total,
                 w.age_rating, w.completion, w.cover_path, w.type, w.kind,
                 CASE WHEN w.kind = 'fanfic' THEN 'fanfic' WHEN w.type = 'comic' THEN 'manga' ELSE 'book' END AS category,
                 w.is_classic, w.publisher_id, w.ai_usage, u.display_name AS author_name
                 FROM works w JOIN users u ON u.id = w.author_id`;

  if (period === 'all') {
    return query<WorkCard>(
      `${base} WHERE w.status = 'published' AND ${cat}
        ORDER BY w.views_total DESC, w.rating_avg DESC LIMIT $1`,
      [limit],
    );
  }

  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
  const pg = Boolean(process.env.DATABASE_URL);
  const cutoff = pg ? `NOW() - INTERVAL '${days} days'` : `datetime('now','-${days} days')`;

  return query<WorkCard>(
    `${base} JOIN work_views v ON v.work_id = w.id
      WHERE w.status = 'published' AND ${cat} AND v.created_at >= ${cutoff}
      GROUP BY w.id
      ORDER BY COUNT(v.id) DESC, w.views_total DESC
      LIMIT $1`,
    [limit],
  );
}


/** Теги из БД с числом произведений — для панели фильтров. */
export async function listTags(limit = 300): Promise<Array<{ slug: string; name: string; count: number }>> {
  await ensure();
  const rows = await query<{ slug: string; name: string; count: number | string }>(
    `SELECT t.slug, t.name, COUNT(wt.work_id) AS count
       FROM tags t LEFT JOIN work_tags wt ON wt.tag_id = t.id
      GROUP BY t.id, t.slug, t.name
      ORDER BY count DESC, t.slug ASC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ slug: r.slug, name: r.name, count: Number(r.count) || 0 }));
}
