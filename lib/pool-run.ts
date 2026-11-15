import { query, one } from './db';
import { subscriptionPoolSplit } from './economy';
import { normalizeReadings, distributePool, type Reading } from './pool';

export type PoolRunResult =
  | { ok: true; already: true; month: string }
  | { ok: true; already: false; month: string; revenue_cents: number; pool_cents: number; distributed_cents: number; works: number };

/**
 * Месячный запуск пула (ТЗ 7.4): выручка подписок → пул 50% → нормализованные страницы → журнал.
 * Идемпотентно: повторный запуск за тот же месяц возвращает already:true и ничего не дублирует.
 */
export async function runPool(month: string, revenueCents: number): Promise<PoolRunResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('bad_month');

  const existing = await one<{ id: number }>('SELECT id FROM pool_runs WHERE month = $1', [month]);
  if (existing) return { ok: true, already: true, month };

  // Чтения за месяц: приближение по прогрессу (доля книги × страницы произведения).
  const rows = await query<{ user_id: number; work_id: number; percent: number; words_total: number }>(
    `SELECT rp.user_id, rp.work_id, rp.percent, w.words_total
       FROM reading_progress rp JOIN works w ON w.id = rp.work_id
      WHERE rp.updated_at >= $1 AND rp.updated_at < $2`,
    [`${month}-01`, nextMonth(month)]
  );

  const workPages: Record<number, number> = {};
  const readings: Reading[] = [];
  for (const r of rows) {
    const pages = Math.max(0, Math.round((Number(r.words_total) || 0) / 1800));
    workPages[r.work_id] = pages;
    const readPages = Math.round((pages * Math.min(100, Math.max(0, Number(r.percent) || 0))) / 100);
    if (readPages > 0) readings.push({ userId: Number(r.user_id), workId: Number(r.work_id), pages: readPages });
  }

  const split = subscriptionPoolSplit(Math.max(0, Math.trunc(revenueCents)));
  const normalized = normalizeReadings(readings, workPages);
  const dist = distributePool(split.pool_cents, normalized);

  const run = await one<{ id: number }>(
    `INSERT INTO pool_runs (month, revenue_cents, pool_cents, distributed_cents)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [month, split.amount_cents, split.pool_cents, dist.distributed_cents]
  );

  for (const w of dist.byWork) {
    const author = await one<{ author_id: number }>('SELECT author_id FROM works WHERE id = $1', [w.workId]);
    await query(
      `INSERT INTO pool_ledger (pool_run_id, work_id, author_id, pages, cents) VALUES ($1,$2,$3,$4,$5)`,
      [run!.id, w.workId, author?.author_id ?? null, w.pages, w.cents]
    );
  }

  return {
    ok: true, already: false, month,
    revenue_cents: split.amount_cents, pool_cents: split.pool_cents,
    distributed_cents: dist.distributed_cents, works: dist.byWork.length,
  };
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
