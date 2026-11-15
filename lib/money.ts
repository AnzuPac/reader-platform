/**
 * Деньги платформы.
 *
 * 1 монета = 1 RSD. Книги продаются в RSD напрямую, главы — в монетах.
 * Все суммы хранятся целыми числами: amount_cents — пара RSD, coins — монеты.
 * Никакой арифметики с float: только целые и явное округление.
 */

export const CURRENCY = 'RSD';
export const COIN_VALUE_CENTS = 100; // 1 монета = 1 RSD = 100 пара

export function coinsToCents(coins: number): number {
  return Math.max(0, Math.trunc(Number(coins) || 0)) * COIN_VALUE_CENTS;
}

export function centsToCoins(cents: number): number {
  return Math.max(0, Math.trunc(Number(cents) || 0)) / COIN_VALUE_CENTS;
}

/** Целые монеты из цены в парах: неполная монета отбрасывается. */
export function wholeCoins(cents: number): number {
  return Math.floor(centsToCoins(cents));
}

/** «990 RSD» — без копеек, если сумма кратна динару; иначе с двумя знаками. */
export function formatRsd(cents: number): string {
  const n = Math.trunc(Number(cents) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs % 100 === 0) return `${sign}${abs / 100} RSD`;
  return `${sign}${(abs / 100).toFixed(2).replace('.', ',')} RSD`;
}

export function formatCoins(coins: number): string {
  const n = Math.trunc(Number(coins) || 0);
  return `${n} ${n === 1 ? 'novčić' : n < 5 ? 'novčića' : 'novčića'}`;
}

/** «15 novčića (15 RSD)» — курс всегда 1:1, поэтому эквивалент виден сразу. */
export function coinsWithRsd(coins: number): string {
  return `${formatCoins(coins)} (${formatRsd(coinsToCents(coins))})`;
}
