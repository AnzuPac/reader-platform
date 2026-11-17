import { initSchema, one, query } from './db';
import { translateChapter, type Lang } from './translate';

/**
 * Перевод по схеме «заявка → ИИ → проверка человеком».
 *
 * Автор просит перевод главы, система делает черновик локальной моделью,
 * проверяющий (Кобран/модератор) смотрит и одобряет либо отклоняет.
 * Пока переводу не поставили approved, читатели его не видят: в chapter_translations
 * черновик лежит со статусом draft.
 */

export type RequestOutcome =
  | { ok: true; id: number; status: 'requested' }
  | { ok: false; error: 'not_found' | 'not_published' | 'duplicate' };

export type TranslationRow = {
  id: number; chapter_number: number; work_title: string; work_slug: string;
  target_lang: string; status: string; model: string | null; comment: string | null; created_at: string;
};

export async function requestTranslation(input: {
  chapterId: number; targetLang: Lang; userId: number;
}): Promise<RequestOutcome> {
  await initSchema();
  const ch = await one<{ id: number; status: string; work_id: number; author_id: number }>(
    `SELECT c.id, c.status, c.work_id, w.author_id
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1`, [input.chapterId]
  );
  if (!ch || ch.author_id !== input.userId) return { ok: false, error: 'not_found' };
  if (ch.status !== 'published') return { ok: false, error: 'not_published' };

  const dup = await one<{ id: number }>(
    `SELECT id FROM translation_requests
      WHERE chapter_id = $1 AND target_lang = $2 AND status IN ('requested','ai_done')`,
    [input.chapterId, input.targetLang]
  );
  if (dup) return { ok: false, error: 'duplicate' };

  const rows = await query<{ id: number }>(
    `INSERT INTO translation_requests (chapter_id, target_lang, requested_by)
     VALUES ($1,$2,$3) RETURNING id`,
    [input.chapterId, input.targetLang, input.userId]
  );
  return { ok: true, id: rows[0].id, status: 'requested' };
}

/** Прогон ИИ: черновик перевода появляется в chapter_translations со статусом draft. */
export async function runTranslationAi(requestId: number): Promise<
  { ok: true; model: string } | { ok: false; error: 'not_found' | 'bad_state' | 'failed'; detail?: string }
> {
  await initSchema();
  const r = await one<{ chapter_id: number; target_lang: string; status: string }>(
    'SELECT chapter_id, target_lang, status FROM translation_requests WHERE id = $1', [requestId]
  );
  if (!r) return { ok: false, error: 'not_found' };
  if (!['requested', 'ai_done'].includes(r.status)) return { ok: false, error: 'bad_state' };

  try {
    const res = await translateChapter(r.chapter_id, r.target_lang as Lang);
    await query(
      `UPDATE translation_requests SET status = 'ai_done', model = $2 WHERE id = $1`,
      [requestId, res.model]
    );
    return { ok: true, model: res.model };
  } catch (e) {
    return { ok: false, error: 'failed', detail: String(e).slice(0, 160) };
  }
}

export type ReviewOutcome =
  | { ok: true; status: 'approved' | 'rejected' }
  | { ok: false; error: 'not_found' | 'bad_state' };

/** Решение проверяющего: одобрено — перевод становится видимым, отклонено — остаётся черновиком. */
export async function reviewTranslation(input: {
  id: number; approve: boolean; reviewerId?: number | null; comment?: string | null;
}): Promise<ReviewOutcome> {
  await initSchema();
  const r = await one<{ chapter_id: number; target_lang: string; status: string }>(
    'SELECT chapter_id, target_lang, status FROM translation_requests WHERE id = $1', [input.id]
  );
  if (!r) return { ok: false, error: 'not_found' };
  if (!['requested', 'ai_done'].includes(r.status)) return { ok: false, error: 'bad_state' };

  if (input.approve) {
    await query(
      `UPDATE chapter_translations SET status = 'approved'
        WHERE chapter_id = $1 AND lang = $2 AND status = 'draft'`,
      [r.chapter_id, r.target_lang]
    );
  }
  const status = input.approve ? 'approved' : 'rejected';
  await query(
    `UPDATE translation_requests
        SET status = $2, comment = $3, reviewer_id = $4, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [input.id, status, input.comment ?? null, input.reviewerId ?? null]
  );
  return { ok: true, status };
}

export async function listAuthorTranslations(userId: number, limit = 50): Promise<TranslationRow[]> {
  await initSchema();
  return query<TranslationRow>(
    `SELECT r.id, c.number AS chapter_number, w.title AS work_title, w.slug AS work_slug,
            r.target_lang, r.status, r.model, r.comment, r.created_at
       FROM translation_requests r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE r.requested_by = $1
      ORDER BY r.created_at DESC LIMIT ${Math.max(1, Math.trunc(limit))}`, [userId]
  );
}

/** Очередь проверки: всё, что ждёт ИИ или человека. */
export async function listTranslationQueue(limit = 100): Promise<TranslationRow[]> {
  await initSchema();
  return query<TranslationRow>(
    `SELECT r.id, c.number AS chapter_number, w.title AS work_title, w.slug AS work_slug,
            r.target_lang, r.status, r.model, r.comment, r.created_at
       FROM translation_requests r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE r.status IN ('requested','ai_done')
      ORDER BY r.created_at ASC LIMIT ${Math.max(1, Math.trunc(limit))}`
  );
}
