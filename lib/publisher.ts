import { one, query } from './db';

/**
 * Kabinet izdavača: членство, книги, цены, продажи, роялти, отчёты, выплаты.
 * Все суммы — целые центы; валюта всегда рядом с суммой.
 */

export type Publisher = {
  id: number;
  name: string;
  slug: string;
  contact_email: string;
  commission_pct: number;
  created_at?: string;
};

export type PublisherWorksRow = {
  id: number; slug: string; title: string; status: string; type: string;
  amount_cents: number | null; currency: string | null; active: number | null;
  sales: number; gross_cents: number; royalty_cents: number; commission_cents: number;
};

export type ReportLine = {
  currency: string; sales: number; gross_cents: number;
  commission_cents: number; royalty_cents: number;
};

export type PublisherReport = {
  from: string;
  to: string;
  byCurrency: ReportLine[];
  payable: { currency: string; amount_cents: number }[];
  works: PublisherWorksRow[];
};

export async function getPublisherForUser(userId: number): Promise<(Publisher & { member_role: string }) | null> {
  return one<Publisher & { member_role: string }>(
    `SELECT p.id, p.name, p.slug, p.contact_email, p.commission_pct, p.created_at, m.role AS member_role
       FROM publisher_members m JOIN publishers p ON p.id = m.publisher_id
      WHERE m.user_id = $1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, p.id
      LIMIT 1`,
    [userId]
  );
}

export async function isPublisherMember(userId: number, publisherId: number): Promise<boolean> {
  const row = await one(
    'SELECT 1 AS ok FROM publisher_members WHERE user_id = $1 AND publisher_id = $2',
    [userId, publisherId]
  );
  return !!row;
}

export async function listPublishers(): Promise<Publisher[]> {
  return query<Publisher>('SELECT id, name, slug, contact_email, commission_pct FROM publishers ORDER BY name');
}

export async function getPublisher(id: number): Promise<Publisher | null> {
  return one<Publisher>(
    'SELECT id, name, slug, contact_email, commission_pct FROM publishers WHERE id = $1', [id]
  );
}

export async function publisherWorks(publisherId: number): Promise<PublisherWorksRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT w.id, w.slug, w.title, w.status, w.type,
            bp.amount_cents, bp.currency, bp.active,
            COALESCE(s.sales, 0) AS sales,
            COALESCE(s.gross, 0) AS gross_cents,
            COALESCE(r.royalty, 0) AS royalty_cents,
            COALESCE(r.commission, 0) AS commission_cents
       FROM works w
       LEFT JOIN book_prices bp ON bp.work_id = w.id
       LEFT JOIN (SELECT work_id, COUNT(*) AS sales, SUM(amount_cents) AS gross
                    FROM purchases WHERE status = 'paid' GROUP BY work_id) s ON s.work_id = w.id
       LEFT JOIN (SELECT work_id, SUM(amount_cents - commission_cents) AS royalty,
                         SUM(commission_cents) AS commission
                    FROM royalty_ledger GROUP BY work_id) r ON r.work_id = w.id
      WHERE w.publisher_id = $1
      ORDER BY w.created_at DESC, w.id DESC`,
    [publisherId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    status: String(r.status),
    type: String(r.type),
    amount_cents: r.amount_cents == null ? null : Number(r.amount_cents),
    currency: r.currency == null ? null : String(r.currency),
    active: r.active == null ? null : Number(r.active),
    sales: Number(r.sales),
    gross_cents: Number(r.gross_cents),
    royalty_cents: Number(r.royalty_cents),
    commission_cents: Number(r.commission_cents),
  }));
}

export async function setWorkPrice(
  publisherId: number,
  workId: number,
  price: { amount_cents: number; currency: string; active?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(price.amount_cents) || price.amount_cents < 0) {
    return { ok: false, error: 'invalid_amount' };
  }
  const currency = String(price.currency || '').toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'invalid_currency' };

  const work = await one<{ id: number }>(
    'SELECT id FROM works WHERE id = $1 AND publisher_id = $2', [workId, publisherId]
  );
  if (!work) return { ok: false, error: 'not_found' };

  const active = price.active === false ? 0 : 1;
  await query(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (work_id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents,
       currency = EXCLUDED.currency, active = EXCLUDED.active, updated_at = now()`,
    [workId, price.amount_cents, currency, active]
  );
  return { ok: true };
}

function dateBounds(from?: string | null, to?: string | null): { from: string; toExclusive: string; toLabel: string } {
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  let fromTs = '1970-01-01';
  if (from && isDate(from)) fromTs = from;

  let toLabel = '2999-12-31';
  let toExclusive = '3000-01-01';
  if (to && isDate(to)) {
    toLabel = to;
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    toExclusive = d.toISOString().slice(0, 10);
  }
  return { from: fromTs, toExclusive, toLabel };
}

export async function publisherReport(publisherId: number, from?: string | null, to?: string | null): Promise<PublisherReport> {
  const bounds = dateBounds(from, to);

  const lines = await query<Record<string, unknown>>(
    `SELECT p.currency,
            COUNT(*) AS sales,
            COALESCE(SUM(p.amount_cents), 0) AS gross_cents,
            COALESCE(SUM(r.commission_cents), 0) AS commission_cents,
            COALESCE(SUM(r.amount_cents - r.commission_cents), 0) AS royalty_cents
       FROM purchases p
       JOIN works w ON w.id = p.work_id
       LEFT JOIN royalty_ledger r ON r.purchase_id = p.id
      WHERE w.publisher_id = $1 AND p.status = 'paid'
        AND COALESCE(p.paid_at, p.created_at) >= $2
        AND COALESCE(p.paid_at, p.created_at) < $3
      GROUP BY p.currency
      ORDER BY p.currency`,
    [publisherId, bounds.from, bounds.toExclusive]
  );

  const payableRows = await query<Record<string, unknown>>(
    `SELECT p.currency, COALESCE(SUM(r.amount_cents - r.commission_cents), 0) AS amount_cents
       FROM royalty_ledger r
       JOIN purchases p ON p.id = r.purchase_id
      WHERE r.publisher_id = $1 AND r.status = 'accrued' AND p.status = 'paid'
      GROUP BY p.currency
      ORDER BY p.currency`,
    [publisherId]
  );

  return {
    from: bounds.from,
    to: bounds.toLabel,
    byCurrency: lines.map((r) => ({
      currency: String(r.currency),
      sales: Number(r.sales),
      gross_cents: Number(r.gross_cents),
      commission_cents: Number(r.commission_cents),
      royalty_cents: Number(r.royalty_cents),
    })),
    payable: payableRows.map((r) => ({
      currency: String(r.currency),
      amount_cents: Number(r.amount_cents),
    })),
    works: await publisherWorks(publisherId),
  };
}

export async function listPayouts(publisherId: number) {
  return query<{ id: number; amount_cents: number; status: string; created_at: string; paid_at: string | null }>(
    'SELECT id, amount_cents, status, created_at, paid_at FROM payouts WHERE publisher_id = $1 ORDER BY id DESC',
    [publisherId]
  );
}

export async function createPayout(publisherId: number, amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false as const, error: 'invalid_amount' };
  const rows = await query<{ id: number }>(
    "INSERT INTO payouts (publisher_id, amount_cents, status) VALUES ($1,$2,'pending') RETURNING id",
    [publisherId, amountCents]
  );
  return { ok: true as const, id: rows[0].id };
}

/** Помечает выплату проведённой: роялти периода переходят в статус 'paid'. */
export async function markPayoutPaid(publisherId: number, payoutId: number) {
  const payout = await one<{ id: number; amount_cents: number; status: string }>(
    'SELECT id, amount_cents, status FROM payouts WHERE id = $1 AND publisher_id = $2', [payoutId, publisherId]
  );
  if (!payout) return { ok: false as const, error: 'not_found' };
  if (payout.status === 'paid') return { ok: true as const, already: true };

  await query("UPDATE payouts SET status = 'paid', paid_at = now() WHERE id = $1", [payoutId]);

  // Закрываем ровно начисленные роялти в пределах суммы выплаты (FIFO по id).
  const ledger = await query<{ id: number; share: number }>(
    `SELECT r.id, (r.amount_cents - r.commission_cents) AS share
       FROM royalty_ledger r JOIN purchases p ON p.id = r.purchase_id
      WHERE r.publisher_id = $1 AND r.status = 'accrued' AND p.status = 'paid'
      ORDER BY r.id`,
    [publisherId]
  );
  let budget = payout.amount_cents;
  for (const row of ledger) {
    const share = Number(row.share);
    if (share > budget) break;
    await query("UPDATE royalty_ledger SET status = 'paid' WHERE id = $1", [row.id]);
    budget -= share;
  }
  return { ok: true as const, already: false };
}
