import { describe, it, expect } from 'vitest';
import { computePayout } from '../lib/taxes';

describe('выплаты автору: налоги и взносы (ТЗ 5.5)', () => {
  const opts = { normPct: 43, taxPct: 20, contribPct: 35.4 };

  it('считает разбивку на 10 000 RSD', () => {
    const b = computePayout(10_000, opts);
    expect(b.gross_cents).toBe(10_000);
    expect(b.norm_cents).toBe(4_300);
    expect(b.base_cents).toBe(5_700);
    expect(b.tax_cents).toBe(1_140);
    expect(b.contributions_cents).toBe(2_018);
    expect(b.net_cents).toBe(6_842);
  });

  it('сумма частей сходится с брутто', () => {
    for (const gross of [100, 999, 1_234, 50_000, 123_457]) {
      const b = computePayout(gross, opts);
      expect(b.net_cents + b.tax_cents + b.contributions_cents).toBe(b.gross_cents);
      expect(b.norm_cents + b.base_cents).toBe(b.gross_cents);
    }
  });

  it('нулевая и отрицательная сумма не ломают расчёт', () => {
    expect(computePayout(0, opts).net_cents).toBe(0);
    expect(computePayout(-500, opts).gross_cents).toBe(0);
  });

  it('ставки настраиваются', () => {
    const b = computePayout(10_000, { normPct: 0, taxPct: 10, contribPct: 0 });
    expect(b.tax_cents).toBe(1_000);
    expect(b.net_cents).toBe(9_000);
  });
});
