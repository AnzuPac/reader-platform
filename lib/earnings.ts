import { one, query } from './db';
import { CURRENCY } from './money';
import { authorSharePct, authorCommissionPct } from './economy';

/**
 * Доход автора самиздата: продажи книг/глав (author_earnings) + донаты.
 * Ставка публична: 70%, при эксклюзиве — 80%. Только целые пары RSD.
 */

export type IncomeTotal = {
  currency: string;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
  donations_cents: number;
};

export type WorkIncomeRow = {
  id: number;
  title: string;
  slug: string;
  exclusivity: boolean;
  share_pct: number;
  commission_pct: number;
  sales_cents: number;
  donations_cents: number;
  net_cents: number;
};

export type AuthorPayout = {
  id: number; amount_cents: number; currency: string; status: string; created_at: string; paid_at: string | null;
};

export type AuthorIncome = {
  totals: IncomeTotal[];
  works: WorkIncomeRow[];
  payouts: AuthorPayout[];
  payout_threshold_cents: number;
};

export const PAYOUT_THRESHOLD_CENTS = 200_000; // 2 000 RSD (ТЗ 5.5)

export async function authorIncome(authorId: number): Promise<AuthorIncome> {
  const earned = await query<{ currency: string; gross: number; commission: number; net: number }>(
    `SELECT currency, COALESCE(SUM(amount_cents),0) AS gross,
            COALESCE(SUM(commission_cents),0) AS commission,
            COALESCE(SUM(author_cents),0) AS net
       FROM author_earnings WHERE author_id = $1 GROUP BY currency`,
    [authorId]
  );
  const donated = await query<{ currency: string; gross: number; fee: number; net: number }>(
    `SELECT currency, COALESCE(SUM(amount_cents),0) AS gross,
            COALESCE(SUM(fee_cents),0) AS fee,
            COALESCE(SUM(author_cents),0) AS net
       FROM donations WHERE author_id = $1 AND status = 'paid' GROUP BY currency`,
    [authorId]
  );

  const currencies = new Set<string>([
    CURRENCY,
    ...earned.map((r) => r.currency),
    ...donated.map((r) => r.currency),
  ]);
  const totals: IncomeTotal[] = [...currencies].map((currency) => {
    const e = earned.find((r) => r.currency === currency);
    const d = donated.find((r) => r.currency === currency);
    return {
      currency,
      gross_cents: Number(e?.gross || 0) + Number(d?.gross || 0),
      commission_cents: Number(e?.commission || 0) + Number(d?.fee || 0),
      net_cents: Number(e?.net || 0) + Number(d?.net || 0),
      donations_cents: Number(d?.net || 0),
    };
  });

  const works = await query<Record<string, unknown>>(
    `SELECT w.id, w.title, w.slug, w.exclusivity,
            COALESCE(e.sales, 0) AS sales_cents,
            COALESCE(d.donations, 0) AS donations_cents
       FROM works w
       LEFT JOIN (SELECT work_id, SUM(author_cents) AS sales FROM author_earnings
                   WHERE author_id = $1 GROUP BY work_id) e ON e.work_id = w.id
       LEFT JOIN (SELECT work_id, SUM(author_cents) AS donations FROM donations
                   WHERE author_id = $1 AND status = 'paid' GROUP BY work_id) d ON d.work_id = w.id
      WHERE w.author_id = $1
      ORDER BY w.updated_at DESC, w.id DESC`,
    [authorId]
  );

  const payouts = await query<AuthorPayout>(
    `SELECT id, amount_cents, currency, status, created_at, paid_at
       FROM author_payouts WHERE author_id = $1 ORDER BY id DESC`,
    [authorId]
  );

  return {
    totals,
    works: works.map((r) => {
      const exclusivity = Boolean(Number(r.exclusivity));
      const share = authorSharePct({ exclusivity });
      return {
        id: Number(r.id),
        title: String(r.title),
        slug: String(r.slug),
        exclusivity,
        share_pct: share,
        commission_pct: authorCommissionPct({ exclusivity }),
        sales_cents: Number(r.sales_cents),
        donations_cents: Number(r.donations_cents),
        net_cents: Number(r.sales_cents) + Number(r.donations_cents),
      };
    }),
    payouts,
    payout_threshold_cents: PAYOUT_THRESHOLD_CENTS,
  };
}

/** Эксклюзив — выбор автора: бонус +10 п.п. (80% вместо 70%). */
export async function setWorkExclusivity(
  authorId: number,
  workId: number,
  exclusivity: boolean
): Promise<{ ok: boolean; error?: 'not_found' }> {
  const work = await one('SELECT id FROM works WHERE id = $1 AND author_id = $2', [workId, authorId]);
  if (!work) return { ok: false, error: 'not_found' };
  await query('UPDATE works SET exclusivity = $2, updated_at = now() WHERE id = $1', [workId, exclusivity ? 1 : 0]);
  return { ok: true };
}
