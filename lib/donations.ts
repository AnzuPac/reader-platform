import { one, query } from './db';
import { donationFeePctFor, DEFAULT_DONATION_FEE_PCT } from './economy';

/**
 * Donacije авторам (фанфики и комиксы) и выплаты авторам.
 *
 * Деньги — только целые центы, валюта хранится рядом. Комиссия площадки
 * фиксируется в момент создания доната (fee_cents / author_cents), поэтому
 * изменение tarifaа не переписывает историю. Подтверждение оплаты
 * идемпотентно: повторный вызов не меняет уже оплаченный донат.
 */

export const DONATION_MIN_CENTS = 100;
export const DONATION_MAX_CENTS = 100_000;
export const DONATION_MESSAGE_MAX = 300;
// Решение §10: комиссия с донатов на оригиналы — 0% по умолчанию (настраивается),
// фанфики — всегда 0%.
export const DEFAULT_FEE_PCT = DEFAULT_DONATION_FEE_PCT;

export type DonationStatus = 'pending' | 'paid' | 'refunded';

export type DonationRow = {
  id: number;
  user_id: number;
  work_id: number;
  chapter_id: number | null;
  author_id: number;
  amount_cents: number;
  fee_cents: number;
  author_cents: number;
  currency: string;
  message: string;
  status: DonationStatus;
  provider: 'manual' | 'stripe';
  external_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type DonationSplit = { amount_cents: number; fee_cents: number; author_cents: number };

export function donationFeePct(raw = process.env.DONATION_FEE_PCT): number {
  return donationFeePctFor('original', raw);
}

/** Ставка зависит от типа произведения: фанфик 0%, оригинал — настройка. */
export function donationFeePctForWork(kind: string | null | undefined): number {
  return donationFeePctFor(kind);
}

/** Целочисленный round-half-up, как в lib/royalty.ts. */
export function splitDonation(amountCents: number, pct = donationFeePct()): DonationSplit {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const fee = amount > 0 ? Math.floor((amount * pct + 50) / 100) : 0;
  return { amount_cents: amount, fee_cents: fee, author_cents: amount - fee };
}

export type ValidationResult =
  | { ok: true; amountCents: number; message: string }
  | { ok: false; error: 'invalid_amount' | 'message_too_long' };

export function validateDonation(input: { amountCents?: unknown; message?: unknown }): ValidationResult {
  const amount = Math.trunc(Number(input.amountCents));
  if (!Number.isInteger(amount) || amount < DONATION_MIN_CENTS || amount > DONATION_MAX_CENTS) {
    return { ok: false, error: 'invalid_amount' };
  }
  const message = String(input.message ?? '').trim();
  if (message.length > DONATION_MESSAGE_MAX) return { ok: false, error: 'message_too_long' };
  return { ok: true, amountCents: amount, message };
}

type WorkRow = { id: number; author_id: number; status: string; title: string; kind: string | null };
type ChapterRow = { id: number; work_id: number; number: number; title: string };

export type CreateDonationResult =
  | { ok: true; donation: DonationRow }
  | {
      ok: false;
      error:
        | 'invalid_amount'
        | 'message_too_long'
        | 'self_donation'
        | 'work_not_found'
        | 'chapter_not_found'
        | 'chapter_work_mismatch';
    };

export async function createDonation(
  userId: number,
  input: { workId?: number | null; chapterId?: number | null; amountCents: unknown; message?: unknown },
  provider: 'manual' | 'stripe' = 'manual'
): Promise<CreateDonationResult> {
  const v = validateDonation(input);
  if (!v.ok) return v;

  const chapterId = Number(input.chapterId) || null;
  const workIdInput = Number(input.workId) || null;
  let workId = workIdInput;

  let chapter: ChapterRow | null = null;
  if (chapterId) {
    chapter = await one<ChapterRow>(
      'SELECT id, work_id, number, title FROM chapters WHERE id = $1',
      [chapterId]
    );
    if (!chapter) return { ok: false, error: 'chapter_not_found' };
    if (workId && workId !== chapter.work_id) return { ok: false, error: 'chapter_work_mismatch' };
    workId = chapter.work_id;
  }
  if (!workId) return { ok: false, error: 'work_not_found' };

  const work = await one<WorkRow>('SELECT id, author_id, status, title, kind FROM works WHERE id = $1', [workId]);
  if (!work || work.status !== 'published') return { ok: false, error: 'work_not_found' };
  if (Number(work.author_id) === Number(userId)) return { ok: false, error: 'self_donation' };

  const currencyRow = await one<{ currency: string }>(
    'SELECT currency FROM book_prices WHERE work_id = $1 AND active = 1',
    [workId]
  );
  let currency = currencyRow?.currency || 'RSD';
  if (chapter) {
    const cp = await one<{ currency: string }>(
      'SELECT currency FROM chapter_prices WHERE chapter_id = $1 AND active = TRUE',
      [chapter.id]
    );
    if (cp?.currency) currency = cp.currency;
  }

  const split = splitDonation(v.amountCents, donationFeePctForWork(work.kind));
  const rows = await query<{ id: number }>(
    `INSERT INTO donations
       (user_id, work_id, chapter_id, author_id, amount_cents, fee_cents, author_cents,
        currency, message, status, provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
     RETURNING id`,
    [
      userId, workId, chapter?.id ?? null, work.author_id,
      split.amount_cents, split.fee_cents, split.author_cents,
      currency, v.message, provider,
    ]
  );
  const donation = await one<DonationRow>('SELECT * FROM donations WHERE id = $1', [rows[0].id]);
  return { ok: true, donation: donation as DonationRow };
}

export async function attachDonationCheckout(donationId: number, externalId: string): Promise<void> {
  await query("UPDATE donations SET provider = 'stripe', external_id = $2 WHERE id = $1", [donationId, externalId]);
}

export type PaidDonationResult =
  | { ok: true; donation: DonationRow; already: boolean }
  | { ok: false; error: 'not_found' | 'refunded' };

/** Единственная точка, где донат становится paid. Идемпотентна. */
export async function markDonationPaid(
  donationId: number,
  externalId?: string | null
): Promise<PaidDonationResult> {
  const d = await one<DonationRow>('SELECT * FROM donations WHERE id = $1', [donationId]);
  if (!d) return { ok: false, error: 'not_found' };
  if (d.status === 'paid') return { ok: true, donation: d, already: true };
  if (d.status === 'refunded') return { ok: false, error: 'refunded' };

  await query(
    `UPDATE donations
        SET status = 'paid', paid_at = now(), external_id = COALESCE($2, external_id)
      WHERE id = $1 AND status = 'pending'`,
    [donationId, externalId ?? null]
  );
  const fresh = await one<DonationRow>('SELECT * FROM donations WHERE id = $1', [donationId]);
  return { ok: true, donation: fresh as DonationRow, already: false };
}

export type AuthorBalance = {
  currency: string;
  received_cents: number;
  requested_cents: number;
  available_cents: number;
};

export type DonationHistoryRow = {
  id: number;
  amount_cents: number;
  author_cents: number;
  fee_cents: number;
  currency: string;
  message: string;
  status: string;
  created_at: string;
  donor_name: string;
  work_title: string;
  work_slug: string;
  chapter_number: number | null;
};

export type AuthorPayoutRow = {
  id: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export type AuthorDonationSummary = {
  balances: AuthorBalance[];
  history: DonationHistoryRow[];
  payouts: AuthorPayoutRow[];
};

export async function authorDonationSummary(authorId: number, limit = 50): Promise<AuthorDonationSummary> {
  const received = await query<{ currency: string; total: number; count: number }>(
    `SELECT currency, SUM(author_cents) AS total, COUNT(*) AS count
       FROM donations WHERE author_id = $1 AND status = 'paid'
      GROUP BY currency`,
    [authorId]
  );
  const requested = await query<{ currency: string; total: number }>(
    `SELECT currency, SUM(amount_cents) AS total
       FROM author_payouts WHERE author_id = $1 AND status IN ('pending','paid')
      GROUP BY currency`,
    [authorId]
  );

  const currencies = new Set<string>([...received.map((r) => r.currency), ...requested.map((r) => r.currency)]);
  const balances: AuthorBalance[] = [...currencies].map((currency) => {
    const rec = Number(received.find((r) => r.currency === currency)?.total || 0);
    const req = Number(requested.find((r) => r.currency === currency)?.total || 0);
    return {
      currency,
      received_cents: rec,
      requested_cents: req,
      available_cents: Math.max(0, rec - req),
    };
  });

  const history = await query<DonationHistoryRow>(
    `SELECT d.id, d.amount_cents, d.author_cents, d.fee_cents, d.currency, d.message,
            d.status, d.created_at, u.display_name AS donor_name,
            w.title AS work_title, w.slug AS work_slug, c.number AS chapter_number
       FROM donations d
       JOIN users u ON u.id = d.user_id
       JOIN works w ON w.id = d.work_id
       LEFT JOIN chapters c ON c.id = d.chapter_id
      WHERE d.author_id = $1
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ${Math.max(1, Math.min(200, Math.trunc(limit)))}`,
    [authorId]
  );

  const payouts = await query<AuthorPayoutRow>(
    `SELECT id, amount_cents, currency, status, created_at, paid_at
       FROM author_payouts WHERE author_id = $1
      ORDER BY created_at DESC, id DESC`,
    [authorId]
  );

  return { balances, history, payouts };
}

export type PayoutRequestResult =
  | { ok: true; payoutId: number; amount_cents: number; currency: string; breakdown?: any }
  | { ok: false; error: 'nothing_to_pay' | 'invalid_currency' };

import { computePayout } from './taxes';

export async function requestAuthorPayout(authorId: number, currency = 'RSD'): Promise<PayoutRequestResult> {
  const cur = String(currency || 'RSD').toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(cur)) return { ok: false, error: 'invalid_currency' };

  const summary = await authorDonationSummary(authorId, 1);
  const balance = summary.balances.find((b) => b.currency === cur);
  const available = Number(balance?.available_cents || 0);
  if (available <= 0) return { ok: false, error: 'nothing_to_pay' };

  const b = computePayout(available);
  const rows = await query<{ id: number }>(
    `INSERT INTO author_payouts (author_id, amount_cents, currency, gross_cents, tax_cents, contributions_cents, net_cents, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id`,
    [authorId, available, cur, b.gross_cents, b.tax_cents, b.contributions_cents, b.net_cents]
  );
  return { ok: true, payoutId: rows[0].id, amount_cents: available, currency: cur, breakdown: b };
}

export async function markAuthorPayoutPaid(
  payoutId: number
): Promise<{ ok: true; already: boolean } | { ok: false; error: 'not_found' | 'canceled' }> {
  const p = await one<{ id: number; status: string }>('SELECT id, status FROM author_payouts WHERE id = $1', [payoutId]);
  if (!p) return { ok: false, error: 'not_found' };
  if (p.status === 'paid') return { ok: true, already: true };
  if (p.status === 'canceled') return { ok: false, error: 'canceled' };
  await query("UPDATE author_payouts SET status = 'paid', paid_at = now() WHERE id = $1", [payoutId]);
  return { ok: true, already: false };
}
