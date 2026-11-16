/**
 * Ставки платформы (ТЗ v0.2, решения §10).
 *
 *  - пул правообладателям — 50% (комиссия платформы с подписки);
 *  - самиздат: autoru 70%, при эксклюзиве — 80%;
 *  - издательская книга: комиссия платформы = commission_pct издательства (по умолчанию 50%);
 *  - донаты: фанфик — 0%, оригинал — DONATION_FEE_PCT (по умолчанию 0%);
 *  - безлимитная подписка, без кредитов; рекламы нет.
 *
 * Все ставки — целые проценты, все суммы — целые монеты/пары. Комиссия + доля
 * всегда равны сумме (см. splitRoyalty в lib/royalty.ts).
 */

export const AUTHOR_SHARE_PCT = 70;
export const AUTHOR_EXCLUSIVE_SHARE_PCT = 80;
export const PUBLISHER_COMMISSION_PCT = 50;
export const SUBSCRIPTION_POOL_PCT = 50;
export const DEFAULT_DONATION_FEE_PCT = 0;

export type WorkFlags = { exclusivity?: boolean | number | null; kind?: string | null };

/** Доля автора самиздата: 80% при флаге эксклюзива, иначе 70%. */
export function authorSharePct(work: WorkFlags): number {
  return Boolean(work.exclusivity) ? AUTHOR_EXCLUSIVE_SHARE_PCT : AUTHOR_SHARE_PCT;
}

/** Комиссия платформы с авторской продажи: 30% или 20%. */
export function authorCommissionPct(work: WorkFlags): number {
  return 100 - authorSharePct(work);
}

/** Ставка с донатов: фанфики — 0% всегда, оригиналы — настраиваемая. */
export function donationFeePctFor(kind: string | null | undefined, raw = process.env.DONATION_FEE_PCT): number {
  if (kind === 'fanfic') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_DONATION_FEE_PCT;
  return Math.min(100, Math.max(0, Math.trunc(n)));
}

/** Деление подписочного пула: 50% правообладателям, остальное platformi. */
export function subscriptionPoolSplit(totalCents: number, poolPct = SUBSCRIPTION_POOL_PCT): {
  amount_cents: number;
  pool_cents: number;
  platform_cents: number;
} {
  const amount = Math.max(0, Math.trunc(Number(totalCents) || 0));
  const pct = Math.min(100, Math.max(0, Math.trunc(poolPct)));
  const pool = Math.floor((amount * pct + 50) / 100);
  return { amount_cents: amount, pool_cents: pool, platform_cents: amount - pool };
}

/**
 * Pro-rata распределение пула по нормализованным страницам (метод наибольших
 * остатков): сумма долей всегда равна пулу, ни одной монеты не теряется.
 */
export function proRataShares(poolCents: number, pages: Array<{ id: number; pages: number }>): Array<{ id: number; cents: number }> {
  const pool = Math.max(0, Math.trunc(Number(poolCents) || 0));
  const total = pages.reduce((s, p) => s + Math.max(0, Math.trunc(p.pages) || 0), 0);
  if (!total || !pool) return pages.map((p) => ({ id: p.id, cents: 0 }));

  const base = pages.map((p) => {
    const exact = (pool * Math.max(0, Math.trunc(p.pages) || 0)) / total;
    return { id: p.id, cents: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = pool - base.reduce((s, p) => s + p.cents, 0);
  const order = [...base].sort((a, b) => b.rest - a.rest || a.id - b.id);
  for (const row of order) {
    if (left <= 0) break;
    row.cents += 1;
    left -= 1;
  }
  return base.map((p) => ({ id: p.id, cents: p.cents }));
}
