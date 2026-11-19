import { initSchema, one, query } from './db';

/**
 * Жалобы и очередь модерации.
 *
 * Одна открытая жалоба на объект от одного пользователя: повторное нажатие
 * не плодит записи. Решения фиксируются (status + resolved_by), как требует
 * ТЗ §7.9: «журнал решений».
 */

export const REPORT_TARGETS = ['work', 'comment', 'review', 'user'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ['copyright', 'spam', 'abuse', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type Report = {
  id: number;
  reporter_id: number | null;
  reporter: string | null;
  target_type: string;
  target_id: number;
  reason: string;
  comment: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

async function ensure() {
  await initSchema();
}

export function isReportTarget(v: unknown): v is ReportTarget {
  return typeof v === 'string' && (REPORT_TARGETS as readonly string[]).includes(v);
}

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === 'string' && (REPORT_REASONS as readonly string[]).includes(v);
}

async function targetExists(type: ReportTarget, id: number): Promise<boolean> {
  const table = type === 'work' ? 'works' : type === 'comment' ? 'comments' : type === 'review' ? 'reviews' : 'users';
  const row = await one<{ id: number }>(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  return Boolean(row);
}

export type CreateResult =
  | { ok: true; id: number; duplicate: boolean }
  | { ok: false; reason: 'bad_target' | 'bad_reason' | 'not_found' };

/** Жалоба. Повтор от того же автора на тот же объект возвращает существующую. */
export async function createReport(
  reporterId: number,
  input: { targetType: unknown; targetId: unknown; reason: unknown; comment?: unknown },
): Promise<CreateResult> {
  await ensure();
  if (!isReportTarget(input.targetType)) return { ok: false, reason: 'bad_target' };
  if (!isReportReason(input.reason)) return { ok: false, reason: 'bad_reason' };

  const targetId = Number(input.targetId);
  if (!Number.isFinite(targetId) || targetId <= 0) return { ok: false, reason: 'bad_target' };
  if (!(await targetExists(input.targetType, targetId))) return { ok: false, reason: 'not_found' };

  const open = await one<{ id: number }>(
    `SELECT id FROM reports
      WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
    [reporterId, input.targetType, targetId],
  );
  if (open) return { ok: true, id: open.id, duplicate: true };

  const comment = typeof input.comment === 'string' ? input.comment.slice(0, 1000) : null;
  const rows = await query<{ id: number }>(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, comment, created_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [reporterId, input.targetType, targetId, input.reason, comment, new Date().toISOString()],
  );
  return { ok: true, id: rows[0]?.id ?? 0, duplicate: false };
}

export async function listReports(status = 'open', limit = 50): Promise<Report[]> {
  await ensure();
  return query<Report>(
    `SELECT r.id, r.reporter_id, u.display_name AS reporter, r.target_type, r.target_id,
            r.reason, r.comment, r.status, r.created_at, r.resolved_at, r.resolved_by
       FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.status = $1
      ORDER BY r.created_at DESC LIMIT $2`,
    [status, limit],
  );
}

export type ResolveAction = 'dismiss' | 'hide_comment' | 'hide_review' | 'hide_work';

export type ResolveResult = { ok: boolean; reason?: 'not_found' | 'bad_action' | 'target_missing' };

/** Решение по жалобе: закрыть, скрыть комментарий/отзыв/произведение. */
export async function resolveReport(
  reportId: number, resolver: string, action: ResolveAction,
): Promise<ResolveResult> {
  await ensure();
  const report = await one<{ id: number; target_type: string; target_id: number; status: string }>(
    'SELECT id, target_type, target_id, status FROM reports WHERE id = $1', [reportId],
  );
  if (!report) return { ok: false, reason: 'not_found' };
  if (report.status !== 'open') return { ok: true };

  const targetId = Number(report.target_id);

  if (action === 'hide_comment') {
    await query("UPDATE comments SET status = 'hidden' WHERE id = $1", [targetId]);
  } else if (action === 'hide_review') {
    await query("UPDATE reviews SET status = 'hidden' WHERE id = $1", [targetId]);
  } else if (action === 'hide_work') {
    await query("UPDATE works SET status = 'hidden' WHERE id = $1", [targetId]);
  } else if (action !== 'dismiss') {
    return { ok: false, reason: 'bad_action' };
  }

  await query(
    `UPDATE reports SET status = $1, resolved_at = $2, resolved_by = $3 WHERE id = $4`,
    [action === 'dismiss' ? 'dismissed' : 'resolved', new Date().toISOString(), resolver, reportId],
  );
  return { ok: true };
}

export async function reportCounts(): Promise<{ open: number; resolved: number; dismissed: number }> {
  await ensure();
  const rows = await query<{ status: string; n: number | string }>(
    'SELECT status, COUNT(*) AS n FROM reports GROUP BY status',
  );
  const out = { open: 0, resolved: 0, dismissed: 0 };
  for (const r of rows) {
    if (r.status in out) out[r.status as keyof typeof out] = Number(r.n) || 0;
  }
  return out;
}
