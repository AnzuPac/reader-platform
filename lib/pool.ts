import { proRataShares } from './economy';

/** Порог: чтение засчитывается, если прочитано не меньше 20 страниц И не меньше 10% книги. */
export const MIN_PAGES = 20;
export const MIN_SHARE_PCT = 10;
/** Потолок: не больше 3000 страниц на пользователя в месяц. */
export const PAGES_CAP = 3000;

export type Reading = { userId: number; workId: number; pages: number };

/**
 * Нормализация чтений за месяц:
 * 1) отбрасываем слишком короткие чтения (порог 20 страниц и 10% книги);
 * 2) ограничиваем вклад пользователя 3000 страницами — при превышении масштабируем пропорционально.
 */
export function normalizeReadings(
  readings: Reading[],
  workPages: Record<number, number>,
  cap = PAGES_CAP,
  minPages = MIN_PAGES,
  minPct = MIN_SHARE_PCT
): Reading[] {
  const kept = readings.filter((r) => {
    const total = Number(workPages[r.workId]) || 0;
    const pages = Math.max(0, Math.trunc(r.pages));
    if (pages < minPages) return false;
    if (total > 0 && (pages / total) * 100 < minPct) return false;
    return true;
  });

  const perUser = new Map<number, number>();
  for (const r of kept) perUser.set(r.userId, (perUser.get(r.userId) || 0) + Math.trunc(r.pages));

  return kept.map((r) => {
    const sum = perUser.get(r.userId) || 0;
    if (sum <= cap) return { ...r, pages: Math.trunc(r.pages) };
    const factor = cap / sum;
    return { ...r, pages: Math.floor(Math.trunc(r.pages) * factor) };
  });
}

export type PoolResult = {
  pool_cents: number;
  distributed_cents: number;
  byWork: Array<{ workId: number; pages: number; cents: number }>;
};

/** Распределение пула по произведениям, пропорционально нормализованным страницам. */
export function distributePool(poolCents: number, readings: Reading[]): PoolResult {
  const perWork = new Map<number, number>();
  for (const r of readings) perWork.set(r.workId, (perWork.get(r.workId) || 0) + r.pages);
  const items = [...perWork.entries()].map(([workId, pages]) => ({ id: workId, pages }));
  const shares = proRataShares(poolCents, items);
  const byWork = shares.map((s) => ({ workId: s.id, pages: perWork.get(s.id) || 0, cents: s.cents }));
  const distributed = byWork.reduce((a, b) => a + b.cents, 0);
  return { pool_cents: Math.max(0, Math.trunc(poolCents)), distributed_cents: distributed, byWork };
}
