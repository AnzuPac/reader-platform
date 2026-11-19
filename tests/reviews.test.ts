import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let rv: typeof import('../lib/reviews');
let one: One;
let uid = 0;
let workId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-reviews-'));
  const db = await import('../lib/db');
  one = db.one as One;
  rv = await import('../lib/reviews');
  await db.initSchema();

  uid = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('rev@test','Rev','reader') RETURNING id",
  )).id;
  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description)
     VALUES ('rev-work', $1, 'sr', 'published', 'Delo', '') RETURNING id`,
    [uid],
  )).id;
});

describe('отзывы: право на отзыв', () => {
  it('без прогресса отзыв недоступен', async () => {
    const e = await rv.reviewEligibility(uid, workId);
    expect(e.eligible).toBe(false);
    const res = await rv.upsertReview(uid, workId, { body: 'Очень хорошая книга, советую' });
    expect(res).toEqual({ ok: false, reason: 'not_eligible' });
  });

  it('5% прогресса недостаточно', async () => {
    await one(
      `INSERT INTO reading_progress (user_id, work_id, chapter_id, percent) VALUES ($1,$2,NULL,5)
       ON CONFLICT (user_id, work_id) DO UPDATE SET percent = 5`,
      [uid, workId],
    );
    expect((await rv.reviewEligibility(uid, workId)).eligible).toBe(false);
  });

  it('10% и больше — можно', async () => {
    await one('UPDATE reading_progress SET percent = 12 WHERE user_id = $1 AND work_id = $2', [uid, workId]);
    expect((await rv.reviewEligibility(uid, workId)).eligible).toBe(true);
  });
});

describe('отзывы: запись', () => {
  it('слишком короткий текст отклоняется', async () => {
    const res = await rv.upsertReview(uid, workId, { body: 'ок' });
    expect(res).toEqual({ ok: false, reason: 'bad_body' });
  });

  it('оценка вне 1..5 отклоняется', async () => {
    const res = await rv.upsertReview(uid, workId, { body: 'Нормальная книга, читается легко', rating: 9 });
    expect(res).toEqual({ ok: false, reason: 'bad_rating' });
  });

  it('создаёт отзыв и обновляет рейтинг произведения', async () => {
    const res = await rv.upsertReview(uid, workId, { body: 'Нормальная книга, читается легко', rating: 4 });
    expect(res.ok).toBe(true);

    const list = await rv.listReviews(workId);
    expect(list).toHaveLength(1);
    expect(list[0].rating).toBe(4);

    const w = await one<{ rating_avg: string; ratings_count: number }>(
      'SELECT rating_avg, ratings_count FROM works WHERE id = $1', [workId],
    );
    expect(Number(w.rating_avg)).toBe(4);
    expect(Number(w.ratings_count)).toBe(1);
  });

  it('повторная отправка обновляет тот же отзыв, а не создаёт второй', async () => {
    await rv.upsertReview(uid, workId, { body: 'Обновлённый текст отзыва про книгу', rating: 5 });
    const list = await rv.listReviews(workId);
    expect(list).toHaveLength(1);
    expect(list[0].rating).toBe(5);
  });

  it('удаление своего отзыва убирает его из списка', async () => {
    const mine = await rv.myReview(uid, workId);
    expect(mine).not.toBeNull();
    expect(await rv.deleteOwnReview(uid, mine!.id)).toBe(true);
    expect(await rv.listReviews(workId)).toHaveLength(0);
  });

  it('чужой отзыв удалить нельзя', async () => {
    const res = await rv.upsertReview(uid, workId, { body: 'Ещё один отзыв на это произведение' });
    expect(res.ok).toBe(true);
    const mine = await rv.myReview(uid, workId);
    expect(await rv.deleteOwnReview(uid + 999, mine!.id)).toBe(false);
  });

  it('модератор может скрыть отзыв', async () => {
    const mine = await rv.myReview(uid, workId);
    expect(await rv.hideReview(mine!.id)).toBe(true);
    expect(await rv.listReviews(workId)).toHaveLength(0);
  });
});
