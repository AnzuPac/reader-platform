/**
 * Налоги и взносы при выплате автору (ТЗ 5.5).
 * Ставки настраиваются через окружение; по умолчанию — сербская модель
 * «остали приходи»: нормированные расходы 43%, налог 20% на базу, взносы — отдельной ставкой.
 * ВАЖНО: значения по умолчанию нужно подтвердить с бухгалтером перед публичным запуском.
 */
export type TaxOpts = { normPct: number; taxPct: number; contribPct: number };

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function taxOpts(): TaxOpts {
  return {
    normPct: num(process.env.TAX_NORM_PCT, 43),
    taxPct: num(process.env.TAX_PCT, 20),
    contribPct: num(process.env.TAX_CONTRIB_PCT, 35.4),
  };
}

export type PayoutBreakdown = {
  gross_cents: number;
  norm_cents: number;
  base_cents: number;
  tax_cents: number;
  contributions_cents: number;
  net_cents: number;
  rates: TaxOpts;
};

/** Целочисленный round-half-up, чтобы сумма частей всегда сходилась. */
function r(x: number): number {
  return Math.round(x + 1e-9);
}

export function computePayout(grossCents: number, opts: TaxOpts = taxOpts()): PayoutBreakdown {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const norm = r(gross * (opts.normPct / 100));
  const base = gross - norm;
  const tax = r(base * (opts.taxPct / 100));
  const contributions = r(base * (opts.contribPct / 100));
  const net = Math.max(0, gross - tax - contributions);
  return { gross_cents: gross, norm_cents: norm, base_cents: base, tax_cents: tax, contributions_cents: contributions, net_cents: net, rates: opts };
}
