import { query, one, initSchema } from './db';
import { PARAGRAPH_COMMENTS_SQL, flag } from './search';

/**
 * Komentari к абзацам (ТЗ 4.6, 5.4).
 *
 * Доступны только там, где это разрешено правообладателем: самиздат и фанфики.
 * Для издательских книг и классики isključenы и на чтении, и на записи —
 * проверка одна и та же (works.paragraph_comments_enabled через дефолт).
 */

export type ParagraphComment = {
  id: number; chapter_id: number; paragraph_index: number; user_id: number;
  text: string; hidden: unknown; created_at: string; author: string;
};

export type AddResult =
  | { ok: true; id: number }
  | { ok: false; error: 'disabled' | 'bad_index' | 'bad_text' };

export type HideResult = { ok: true } | { ok: false; error: 'not_found' | 'forbidden' };

const MAX_TEXT = 1000;
const MAX_INDEX = 100000;

/**
 * Диалект нужен ровно в одном месте: колонка hidden — BOOLEAN в PostgreSQL и
 * INTEGER в SQLite. SQLite не принимает boolean-параметр, PostgreSQL — число,
 * поэтому значение подставляется в том виде, который понимает база. В WHERE
 * запросах используется `NOT hidden` — это работает в обоих диалектах.
 */
const isPg = () => !!process.env.DATABASE_URL;

async function chapterMeta(chapterId: number) {
  await initSchema();
  return one<{ id: number; work_id: number; author_id: number; enabled: unknown }>(
    `SELECT c.id, c.work_id, w.author_id, ${PARAGRAPH_COMMENTS_SQL} AS enabled
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1`, [chapterId]
  );
}

export async function paragraphCommentsAllowed(chapterId: number): Promise<boolean> {
  const ch = await chapterMeta(chapterId);
  return !!ch && flag(ch.enabled);
}

export async function listParagraphComments(
  chapterId: number,
  opts: { includeHidden?: boolean } = {}
): Promise<ParagraphComment[]> {
  if (!(await paragraphCommentsAllowed(chapterId))) return [];
  const hiddenClause = opts.includeHidden ? '' : 'AND NOT pc.hidden';
  const rows = await query<ParagraphComment>(
    `SELECT pc.id, pc.chapter_id, pc.paragraph_index, pc.user_id, pc.text, pc.hidden,
            pc.created_at, u.display_name AS author
       FROM paragraph_comments pc JOIN users u ON u.id = pc.user_id
      WHERE pc.chapter_id = $1 ${hiddenClause}
      ORDER BY pc.paragraph_index, pc.created_at LIMIT 500`, [chapterId]
  );
  return rows.map((r) => ({ ...r, hidden: flag(r.hidden) ? 1 : 0 }));
}

export async function addParagraphComment(input: {
  chapterId: number; paragraphIndex: number; userId: number; text: string;
}): Promise<AddResult> {
  const ch = await chapterMeta(input.chapterId);
  if (!ch || !flag(ch.enabled)) return { ok: false, error: 'disabled' };

  const index = Math.trunc(Number(input.paragraphIndex));
  if (!Number.isFinite(index) || index < 0 || index > MAX_INDEX) return { ok: false, error: 'bad_index' };

  const text = String(input.text ?? '').trim();
  if (!text || text.length > MAX_TEXT) return { ok: false, error: 'bad_text' };

  const rows = await query<{ id: number }>(
    `INSERT INTO paragraph_comments (chapter_id, paragraph_index, user_id, text)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [input.chapterId, index, input.userId, text]
  );
  return { ok: true, id: rows[0].id };
}

/** Sakrij/показать комментарий: автор произведения, модератор или админ. */
export async function setParagraphCommentHidden(input: {
  commentId: number; hidden: boolean; actorId: number; actorRole: string;
}): Promise<HideResult> {
  await initSchema();
  const row = await one<{ id: number; chapter_id: number; author_id: number }>(
    `SELECT pc.id, pc.chapter_id, w.author_id
       FROM paragraph_comments pc
       JOIN chapters c ON c.id = pc.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE pc.id = $1`, [input.commentId]
  );
  if (!row) return { ok: false, error: 'not_found' };

  // BIGINT в PostgreSQL драйвер отдаёт строкой, поэтому сравниваем числа.
  const privileged = input.actorRole === 'admin' || input.actorRole === 'moderator';
  if (!privileged && Number(row.author_id) !== input.actorId) return { ok: false, error: 'forbidden' };

  await query('UPDATE paragraph_comments SET hidden = $2 WHERE id = $1',
    [input.commentId, isPg() ? input.hidden : (input.hidden ? 1 : 0)]);
  return { ok: true };
}

export async function countParagraphComments(chapterId: number): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM paragraph_comments WHERE chapter_id = $1 AND NOT hidden', [chapterId]
  );
  return Number(row?.n ?? 0);
}
