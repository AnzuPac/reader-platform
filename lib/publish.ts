import { one, query } from './db';

/** Публикует главы, у которых наступил срок. Ленивая публикация: вызывается
 *  при доступе к главе или списку глав, поэтому отдельный cron не нужен. */
export async function publishDue(workId?: number): Promise<number> {
  const now = new Date().toISOString();
  const rows = workId
    ? await query<{ id: number }>(
        `UPDATE chapters SET status = 'published', published_at = $1
          WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= $1 AND work_id = $2
          RETURNING id`, [now, workId])
    : await query<{ id: number }>(
        `UPDATE chapters SET status = 'published', published_at = $1
          WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= $1
          RETURNING id`, [now]);
  return rows.length;
}

/** Дешёвая проверка перед UPDATE: не трогаем таблицу зря на каждом запросе. */
export async function publishDueIfAny(workId?: number): Promise<number> {
  const now = new Date().toISOString();
  const due = workId
    ? await one<{ id: number }>(
        `SELECT id FROM chapters WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= $1 AND work_id = $2 LIMIT 1`,
        [now, workId]).catch(() => null)
    : await one<{ id: number }>(
        `SELECT id FROM chapters WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= $1 LIMIT 1`,
        [now]).catch(() => null);
  if (!due) return 0;
  return publishDue(workId);
}

export async function scheduleChapter(workId: number, number: number, publishAt: string): Promise<void> {
  await query(
    `UPDATE chapters SET publish_at = $1, status = 'draft' WHERE work_id = $2 AND number = $3`,
    [publishAt, workId, number],
  );
}

export async function clearSchedule(workId: number, number: number): Promise<void> {
  await query(
    `UPDATE chapters SET publish_at = NULL WHERE work_id = $1 AND number = $2`,
    [workId, number],
  );
}
