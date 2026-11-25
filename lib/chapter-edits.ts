import { initSchema, one, query } from './db';

/**
 * Заявки на правку уже опубликованных глав.
 *
 * Опубликованный текст меняется только через модерацию: автор присылает заявку,
 * админ или модератор одобряет (правка применяется) либо отклоняет (текст остаётся).
 * Черновики правятся напрямую — там модерация не нужна.
 */

export type SubmitResult =
  | { ok: true; id: number }
  | { ok: false; error: 'not_found' | 'not_published' };

export type ReviewResult =
  | { ok: true; status: 'approved' | 'rejected' }
  | { ok: false; error: 'not_found' | 'not_pending' };

export type AuthorEditRow = {
  id: number; chapter_number: number; work_title: string; work_slug: string;
  title: string; status: string; comment: string | null; created_at: string;
};

export type PendingEditRow = AuthorEditRow & { author: string; word_count: number };

export async function submitChapterEdit(input: {
  workSlug: string; number: number; authorId: number;
  title: string; content: string; wordCount: number;
}): Promise<SubmitResult> {
  await initSchema();
  const work = await one<{ id: number; author_id: number }>(
    'SELECT id, author_id FROM works WHERE slug = $1', [input.workSlug]
  );
  if (!work || Number(work.author_id) !== Number(input.authorId)) return { ok: false, error: 'not_found' };

  const ch = await one<{ id: number; status: string }>(
    'SELECT id, status FROM chapters WHERE work_id = $1 AND number = $2', [work.id, input.number]
  );
  if (!ch) return { ok: false, error: 'not_found' };
  if (ch.status !== 'published') return { ok: false, error: 'not_published' };

  // Новая заявка заменяет прежнюю ожидающую: копить дубли незачем.
  await query(
    `UPDATE chapter_edit_requests
        SET status = 'rejected', comment = COALESCE(comment, 'zamenjena novom zahtevom'),
            reviewed_at = CURRENT_TIMESTAMP
      WHERE chapter_id = $1 AND status = 'pending'`, [ch.id]
  );
  const rows = await query<{ id: number }>(
    `INSERT INTO chapter_edit_requests (chapter_id, author_id, title, content, word_count)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [ch.id, input.authorId, input.title, input.content, Math.max(0, Math.trunc(input.wordCount))]
  );
  return { ok: true, id: rows[0].id };
}

export async function listAuthorEdits(authorId: number, limit = 50): Promise<AuthorEditRow[]> {
  await initSchema();
  return query<AuthorEditRow>(
    `SELECT r.id, c.number AS chapter_number, w.title AS work_title, w.slug AS work_slug,
            r.title, r.status, r.comment, r.created_at
       FROM chapter_edit_requests r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE r.author_id = $1
      ORDER BY r.created_at DESC LIMIT ${Math.max(1, Math.trunc(limit))}`, [authorId]
  );
}

export async function listPendingEdits(limit = 100): Promise<PendingEditRow[]> {
  await initSchema();
  return query<PendingEditRow>(
    `SELECT r.id, c.number AS chapter_number, w.title AS work_title, w.slug AS work_slug,
            r.title, r.status, r.comment, r.created_at, r.word_count,
            u.display_name AS author
       FROM chapter_edit_requests r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
       JOIN users u ON u.id = r.author_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC LIMIT ${Math.max(1, Math.trunc(limit))}`
  );
}

export async function reviewChapterEdit(input: {
  id: number; approve: boolean; reviewerId?: number | null; comment?: string | null;
}): Promise<ReviewResult> {
  await initSchema();
  const row = await one<{ id: number; chapter_id: number; title: string; content: string; word_count: number; status: string }>(
    'SELECT id, chapter_id, title, content, word_count, status FROM chapter_edit_requests WHERE id = $1',
    [input.id]
  );
  if (!row) return { ok: false, error: 'not_found' };
  if (row.status !== 'pending') return { ok: false, error: 'not_pending' };

  if (input.approve) {
    // Статус главы не трогаем: она уже опубликована и остаётся опубликованной.
    await query(
      'UPDATE chapters SET title = $2, content = $3, word_count = $4 WHERE id = $1',
      [row.chapter_id, row.title, row.content, row.word_count]
    );
  }
  const status = input.approve ? 'approved' : 'rejected';
  await query(
    `UPDATE chapter_edit_requests
        SET status = $2, comment = $3, reviewer_id = $4, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [input.id, status, input.comment ?? null, input.reviewerId ?? null]
  );
  return { ok: true, status };
}
