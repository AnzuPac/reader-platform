/**
 * Роялти и комиссия площадки.
 *
 * Деньги — только целые центы/копейки. Комиссия издателя — целые проценты
 * (см. publishers.commission_pct), поэтому вся арифметика целочисленная:
 * доля площадки округляется вверх до целого цента (round-half-up), а доля
 * издателя — это остаток. Сумма двух частей всегда равна сумме покупки,
 * ни один цент не теряется и не появляется.
 */

export type RoyaltySplit = {
  amount_cents: number;
  commission_cents: number;
  publisher_cents: number;
};

export function commissionFor(amountCents: number, commissionPct: number): number {
  const amount = Math.trunc(Number(amountCents) || 0);
  if (amount <= 0) return 0;
  const pct = Math.min(100, Math.max(0, Math.trunc(Number(commissionPct) || 0)));
  // Целочисленный round-half-up: (a*pct + 50) / 100
  return Math.floor((amount * pct + 50) / 100);
}

export function splitRoyalty(amountCents: number, commissionPct: number): RoyaltySplit {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const commission_cents = commissionFor(amount, commissionPct);
  return {
    amount_cents: amount,
    commission_cents,
    publisher_cents: amount - commission_cents,
  };
}
