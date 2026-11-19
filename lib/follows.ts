import { initSchema, one, query } from './db';

/**
 * Подписка на автора.
 *
 * Подписаться можно на того, у кого есть опубликованное произведение (иначе
 * «подписка на пустоту» и мусор в уведомлениях). На себя — нельзя.
 */

async function ensure() {
  await initSchema();
}

export async function isAuthor(authorId: number): Promise<boolean> {
  await ensure();
  const row = await one<{ id: number }>(
    "SELECT w.id FROM works w WHERE w.author_id = $1 AND w.status = 'published' LIMIT 1", [authorId],
  );
  return Boolean(row);
}

export async function isFollowing(userId: number, authorId: number): Promise<boolean> {
  await ensure();
  const row = await one<{ user_id: number }>(
    'SELECT user_id FROM author_follows WHERE user_id = $1 AND author_id = $2', [userId, authorId],
  );
  return Boolean(row);
}

export type FollowResult = { ok: true; following: boolean } | { ok: false; reason: 'self' | 'not_author' | 'bad_input' };

export async function follow(userId: number, authorId: number): Promise<FollowResult> {
  await ensure();
  if (!Number.isFinite(authorId) || authorId <= 0) return { ok: false, reason: 'bad_input' };
  if (userId === authorId) return { ok: false, reason: 'self' };
  if (!(await isAuthor(authorId))) return { ok: false, reason: 'not_author' };

  await query(
    `INSERT INTO author_follows (user_id, author_id) VALUES ($1,$2)
     ON CONFLICT (user_id, author_id) DO NOTHING`,
    [userId, authorId],
  );
  return { ok: true, following: true };
}

export async function unfollow(userId: number, authorId: number): Promise<FollowResult> {
  await ensure();
  if (!Number.isFinite(authorId) || authorId <= 0) return { ok: false, reason: 'bad_input' };
  await query('DELETE FROM author_follows WHERE user_id = $1 AND author_id = $2', [userId, authorId]);
  return { ok: true, following: false };
}

export async function followerCount(authorId: number): Promise<number> {
  await ensure();
  const row = await one<{ n: number | string }>(
    'SELECT COUNT(*) AS n FROM author_follows WHERE author_id = $1', [authorId],
  );
  return Number(row?.n ?? 0);
}

export async function listFollowedAuthors(userId: number): Promise<{ id: number; name: string }[]> {
  await ensure();
  return query<{ id: number; name: string }>(
    `SELECT u.id, u.display_name AS name
       FROM author_follows f JOIN users u ON u.id = f.author_id
      WHERE f.user_id = $1 AND u.status = 'active'
      ORDER BY f.created_at DESC`,
    [userId],
  );
}

/** Новые главы у авторов, на которых подписан читатель — для ленты уведомлений. */
export async function newChaptersFromFollowed(userId: number, days = 45, limit = 30) {
  await ensure();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return query<{
    chapter_id: number; chapter_title: string | null; number: number; published_at: string;
    slug: string; title: string; author_name: string; author_id: number;
  }>(
    `SELECT c.id AS chapter_id, c.title AS chapter_title, c.number, c.published_at,
            w.slug, w.title, u.display_name AS author_name, u.id AS author_id
       FROM author_follows f
       JOIN works w ON w.author_id = f.author_id AND w.status = 'published'
       JOIN users u ON u.id = w.author_id
       JOIN chapters c ON c.work_id = w.id AND c.status = 'published'
      WHERE f.user_id = $1 AND c.published_at IS NOT NULL AND c.published_at >= $2
      ORDER BY c.published_at DESC
      LIMIT $3`,
    [userId, since, limit],
  );
}

/** Сколько новых глав у подписок за неделю — для бейджа. */
export async function countFollowUpdates(userId: number, days = 7): Promise<number> {
  await ensure();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const row = await one<{ n: number | string }>(
    `SELECT COUNT(*) AS n
       FROM author_follows f
       JOIN works w ON w.author_id = f.author_id AND w.status = 'published'
       JOIN chapters c ON c.work_id = w.id AND c.status = 'published'
      WHERE f.user_id = $1 AND c.published_at IS NOT NULL AND c.published_at >= $2`,
    [userId, since],
  );
  return Number(row?.n ?? 0);
}
