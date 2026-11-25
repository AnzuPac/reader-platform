import { one, query } from './db';

export type ChapterVersion = {
  id: number; chapter_id: number; work_id: number; number: number;
  title: string; content: string; word_count: number; source: string; created_at: string;
};

const KEEP_PER_CHAPTER = 50;
const THROTTLE_MS = 10 * 60 * 1000; // одинаковый текст — не чаще раза в 10 минут

/** Сохраняет версию главы. Одинаковый текст подряд не дублируется.
 *  Хранится последние 50 версий на главу. */
export async function saveVersion(input: {
  chapterId: number; workId: number; userId: number; number: number;
  title: string; content: string; wordCount: number; source?: string;
}): Promise<{ versionId: number | null; skipped: boolean }> {
  const latest = await one<{ id: number; content: string; created_at: string }>(
    'SELECT id, content, created_at FROM chapter_versions WHERE chapter_id = $1 ORDER BY id DESC LIMIT 1',
    [input.chapterId],
  ).catch(() => null);

  if (latest && latest.content === input.content) {
    // SQLite отдаёт CURRENT_TIMESTAMP без таймзоны — трактуем как UTC.
    const raw = String(latest.created_at);
    const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
    const age = Date.now() - Date.parse(iso);
    if (Number.isFinite(age) && age >= 0 && age < THROTTLE_MS) {
      return { versionId: latest.id, skipped: true };
    }
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO chapter_versions (chapter_id, work_id, user_id, number, title, content, word_count, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.chapterId, input.workId, input.userId, input.number, input.title,
      input.content, input.wordCount, input.source || 'autosave'],
  );
  await query(
    `DELETE FROM chapter_versions WHERE chapter_id = $1 AND id NOT IN (
       SELECT id FROM chapter_versions WHERE chapter_id = $1 ORDER BY id DESC LIMIT $2
     )`,
    [input.chapterId, KEEP_PER_CHAPTER],
  ).catch(() => {});
  return { versionId: rows[0].id, skipped: false };
}

export async function listVersions(chapterId: number, limit = 30): Promise<ChapterVersion[]> {
  return query<ChapterVersion>(
    `SELECT id, chapter_id, work_id, number, title, content, word_count, source, created_at
       FROM chapter_versions WHERE chapter_id = $1 ORDER BY id DESC LIMIT $2`,
    [chapterId, Math.max(1, Math.min(limit, 100))],
  );
}

export async function getVersionForUser(versionId: number, userId: number): Promise<(ChapterVersion & { chapter_status: string }) | null> {
  return one<ChapterVersion & { chapter_status: string }>(
    `SELECT v.id, v.chapter_id, v.work_id, v.number, v.title, v.content, v.word_count, v.source, v.created_at,
            c.status AS chapter_status
       FROM chapter_versions v
       JOIN chapters c ON c.id = v.chapter_id
       JOIN works w ON w.id = v.work_id
      WHERE v.id = $1 AND w.author_id = $2`,
    [versionId, userId],
  );
}
