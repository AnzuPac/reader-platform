import { initSchema, one, query } from './db';

/**
 * Отзывы: текст + оценка, только от читателей, реально прочитавших произведение.
 *
 * Порог — 10% прогресса или хотя бы одна дочитанная глава. Правило из ТЗ §4.5:
 * «отзывы и оценки только прочитавшим ≥10%». Одна запись на (пользователь, произведение).
 */

export const REVIEW_MIN_PERCENT = 10;
export const REVIEW_MIN_BODY = 10;
export const REVIEW_MAX_BODY = 4000;

export type Review = {
  id: number;
  user_id: number;
  work_id: number;
  rating: number | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: string;
};

async function ensure() {
  await initSchema();
}

/** Право на отзыв: прогресс по произведению или покупка (купил — значит читает). */
export async function reviewEligibility(
  userId: number, workId: number,
): Promise<{ eligible: boolean; percent: number }> {
  await ensure();
  const p = await one<{ percent: number | null }>(
    'SELECT MAX(percent) AS percent FROM reading_progress WHERE user_id = $1 AND work_id = $2',
    [userId, workId],
  );
  const percent = Number(p?.percent ?? 0);
  return { eligible: percent >= REVIEW_MIN_PERCENT, percent };
}

export async function myReview(userId: number, workId: number): Promise<Review | null> {
  await ensure();
  return one<Review>(
    `SELECT r.id, r.user_id, r.work_id, r.rating, r.body, r.created_at, r.updated_at, u.display_name AS author
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.user_id = $1 AND r.work_id = $2 AND r.status = 'visible'`,
    [userId, workId],
  );
}

export async function listReviews(workId: number, limit = 20): Promise<Review[]> {
  await ensure();
  return query<Review>(
    `SELECT r.id, r.user_id, r.work_id, r.rating, r.body, r.created_at, r.updated_at, u.display_name AS author
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.work_id = $1 AND r.status = 'visible'
      ORDER BY r.updated_at DESC LIMIT $2`,
    [workId, limit],
  );
}

export type UpsertResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'not_eligible' | 'bad_body' | 'bad_rating' };

export async function upsertReview(
  userId: number, workId: number, input: { rating?: number | null; body: string },
): Promise<UpsertResult> {
  await ensure();

  const body = String(input.body || '').trim();
  if (body.length < REVIEW_MIN_BODY || body.length > REVIEW_MAX_BODY) return { ok: false, reason: 'bad_body' };

  let rating: number | null = null;
  if (input.rating !== undefined && input.rating !== null) {
    const r = Number(input.rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) return { ok: false, reason: 'bad_rating' };
    rating = Math.round(r);
  }

  const { eligible } = await reviewEligibility(userId, workId);
  if (!eligible) return { ok: false, reason: 'not_eligible' };

  const now = new Date().toISOString();
  const rows = await query<{ id: number }>(
    `INSERT INTO reviews (user_id, work_id, rating, body, updated_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, work_id)
     DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body,
                   updated_at = EXCLUDED.updated_at, status = 'visible'
     RETURNING id`,
    [userId, workId, rating, body, now],
  );

  // Оценка из отзыва идёт в общий рейтинг произведения.
  if (rating) {
    await query(
      `INSERT INTO ratings (user_id, work_id, value) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, work_id) DO UPDATE SET value = EXCLUDED.value`,
      [userId, workId, rating],
    );
    await recomputeWorkRating(workId);
  }

  return { ok: true, id: rows[0]?.id ?? 0 };
}

export async function recomputeWorkRating(workId: number): Promise<void> {
  await ensure();
  const agg = await one<{ n: number | string; avg: number | string }>(
    'SELECT COUNT(*) AS n, COALESCE(AVG(value), 0) AS avg FROM ratings WHERE work_id = $1', [workId],
  );
  await query(
    'UPDATE works SET ratings_count = $2, rating_avg = ROUND($3, 2) WHERE id = $1',
    [workId, Number(agg?.n ?? 0), Number(agg?.avg ?? 0)],
  );
}

export async function deleteOwnReview(userId: number, reviewId: number): Promise<boolean> {
  await ensure();
  const row = await one<{ id: number }>(
    'SELECT id FROM reviews WHERE id = $1 AND user_id = $2', [reviewId, userId],
  );
  if (!row) return false;
  await query("UPDATE reviews SET status = 'deleted' WHERE id = $1", [reviewId]);
  return true;
}

/** Скрытие отзыва модератором (по жалобе). */
export async function hideReview(reviewId: number): Promise<boolean> {
  await ensure();
  const row = await one<{ id: number }>('SELECT id FROM reviews WHERE id = $1', [reviewId]);
  if (!row) return false;
  await query("UPDATE reviews SET status = 'hidden' WHERE id = $1", [reviewId]);
  return true;
}
