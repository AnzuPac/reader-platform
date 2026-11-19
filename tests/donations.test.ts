import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>, one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>, initSchema: any;
let donations: any;

let authorId = 0;
let donorId = 0;
let workId = 0;
let chapterId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-donations-'));
  const db = await import('../lib/db');
  query = db.query; one = db.one as typeof one; initSchema = db.initSchema;
  await initSchema();
  donations = await import('../lib/donations');

  const mkUser = async (email: string) =>
    (await one<{ id: number }>(
      'INSERT INTO users (email, display_name, role) VALUES ($1,$2,$3) RETURNING id',
      [email, email.split('@')[0], 'author']
    ))!.id;

  authorId = await mkUser('author-donate@test.rs');
  donorId = await mkUser('donor@test.rs');

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, published_at)
     VALUES ('donate-knjiga', $1, 'sr', 'published', 'Doniraj knjigu', CURRENT_TIMESTAMP) RETURNING id`,
    [authorId]
  ))!.id;
  await query('INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES ($1, 500, $2, 1)', [workId, 'RSD']);
  chapterId = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 1, 'Prva', 'tekst', 'paid', 200, 'published') RETURNING id`,
    [workId]
  ))!.id;
});

describe('валидация доната', () => {
  it('сумма 100–100000 центов включительно', () => {
    expect(donations.validateDonation({ amountCents: 99 })).toEqual({ ok: false, error: 'invalid_amount' });
    expect(donations.validateDonation({ amountCents: 100 })).toMatchObject({ ok: true, amountCents: 100 });
    expect(donations.validateDonation({ amountCents: 100000 })).toMatchObject({ ok: true, amountCents: 100000 });
    expect(donations.validateDonation({ amountCents: 100001 })).toEqual({ ok: false, error: 'invalid_amount' });
    expect(donations.validateDonation({ amountCents: 12.5 })).toEqual({ ok: false, error: 'invalid_amount' });
  });

  it('сообщение не длиннее 300 символов', () => {
    expect(donations.validateDonation({ amountCents: 500, message: 'a'.repeat(300) })).toMatchObject({ ok: true });
    expect(donations.validateDonation({ amountCents: 500, message: 'a'.repeat(301) })).toEqual({
      ok: false,
      error: 'message_too_long',
    });
  });
});

describe('комиссия платформы', () => {
  it('донаты: оригинал 0% по умолчанию, фанфик 0%, ставка настраивается', () => {
    expect(donations.DEFAULT_FEE_PCT).toBe(0);
    expect(donations.donationFeePctForWork('original')).toBe(0);
    expect(donations.donationFeePctForWork('fanfic')).toBe(0);
    expect(donations.donationFeePctForWork('original', '5')).toBe(0); // env читается из economy
    expect(donations.donationFeePct('5')).toBe(5);
    expect(donations.splitDonation(500, 0)).toEqual({ amount_cents: 500, fee_cents: 0, author_cents: 500 });
    expect(donations.splitDonation(101, 5)).toEqual({ amount_cents: 101, fee_cents: 5, author_cents: 96 });
    const s = donations.splitDonation(1000, 5);
    expect(s.fee_cents + s.author_cents).toBe(s.amount_cents);
  });
});

describe('создание и подтверждение доната', () => {
  it('нельзя донатить самому себе', async () => {
    const res = await donations.createDonation(authorId, { workId, amountCents: 500 });
    expect(res).toEqual({ ok: false, error: 'self_donation' });
  });

  it('создаёт pending-донат с зафиксированной комиссией', async () => {
    const res = await donations.createDonation(donorId, {
      workId,
      chapterId,
      amountCents: 500,
      message: 'Hvala!',
    });
    expect(res.ok).toBe(true);
    expect(res.donation.status).toBe('pending');
    expect(res.donation.amount_cents).toBe(500);
    expect(res.donation.fee_cents).toBe(0);
    expect(res.donation.author_cents).toBe(500);
    expect(res.donation.currency).toBe('RSD');
  });

  it('подтверждение идемпотентно и начисляет автору долю', async () => {
    const created = await donations.createDonation(donorId, { workId, amountCents: 1000 });
    expect(created.ok).toBe(true);
    const id = created.donation.id;

    const paid = await donations.markDonationPaid(id, 'ext-1');
    expect(paid.ok).toBe(true);
    expect(paid.already).toBe(false);
    expect(paid.donation.author_cents).toBe(1000);

    const again = await donations.markDonationPaid(id, 'ext-1');
    expect(again.ok).toBe(true);
    expect(again.already).toBe(true);

    const summary = await donations.authorDonationSummary(authorId);
    const rsd = summary.balances.find((b: any) => b.currency === 'RSD');
    // Первый донат (500) остался pending и в баланс не входит.
    expect(rsd.received_cents).toBe(1000);
    expect(rsd.available_cents).toBe(1000);
    expect(summary.history.length).toBeGreaterThanOrEqual(2);
  });

  it('заявка на выплату обнуляет доступный баланс и не создаётся дважды', async () => {
    const first = await donations.requestAuthorPayout(authorId, 'RSD');
    expect(first.ok).toBe(true);
    expect(first.amount_cents).toBe(1000);

    const second = await donations.requestAuthorPayout(authorId, 'RSD');
    expect(second).toEqual({ ok: false, error: 'nothing_to_pay' });

    const summary = await donations.authorDonationSummary(authorId);
    expect(summary.balances.find((b: any) => b.currency === 'RSD').available_cents).toBe(0);
    expect(summary.payouts.length).toBe(1);
  });
});
