import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: any, one: any, initSchema: any;
let coins: any, purchases: any, economy: any, subs: any, donations: any, earnings: any, royalty: any;

let authorId = 0;
let readerId = 0;
let workId = 0;
let chapterId = 0;
let chapter2Id = 0;

async function mkUser(email: string, role = 'reader') {
  return (await one<{ id: number }>(
    'INSERT INTO users (email, display_name, role) VALUES ($1,$2,$3) RETURNING id',
    [email, email.split('@')[0], role]
  ))!.id;
}

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-economy-'));
  const db = await import('../lib/db');
  query = db.query; one = db.one; initSchema = db.initSchema;
  await initSchema();

  coins = await import('../lib/coins');
  purchases = await import('../lib/purchases');
  economy = await import('../lib/economy');
  subs = await import('../lib/subscriptions');
  donations = await import('../lib/donations');
  earnings = await import('../lib/earnings');
  royalty = await import('../lib/royalty');

  authorId = await mkUser('economy-author@test.rs', 'author');
  readerId = await mkUser('economy-reader@test.rs');

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, published_at)
     VALUES ('economy-knjiga', $1, 'sr', 'published', 'Ekonomija', CURRENT_TIMESTAMP) RETURNING id`,
    [authorId]
  ))!.id;
  await query(`INSERT INTO book_prices (work_id, amount_cents, currency, active) VALUES ($1, 99000, 'RSD', 1)`, [workId]);

  chapterId = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 1, 'Prva', 'tekst', 'paid', 1500, 'published') RETURNING id`,
    [workId]
  ))!.id;
  chapter2Id = (await one<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, access, price_cents, status)
     VALUES ($1, 2, 'Druga', 'tekst', 'paid', 1500, 'published') RETURNING id`,
    [workId]
  ))!.id;
  await purchases.setChapterCoins(chapterId, 15);
  await purchases.setChapterCoins(chapter2Id, 15);
});

describe('монеты: пополнение, журнал, возврат', () => {
  it('пакет 500 даёт 500 монет и запись topup, повтор — идемпотентен', async () => {
    const created = await coins.createCoinOrder(readerId, 'coins_500');
    expect(created.ok).toBe(true);

    const paid = await coins.markCoinOrderPaid(created.order.id);
    expect(paid.ok).toBe(true);
    expect(paid.coins).toBe(500);
    expect(paid.balance).toBe(500);

    const again = await coins.markCoinOrderPaid(created.order.id);
    expect(again.ok && again.already).toBe(true);
    expect(await coins.walletBalance(readerId)).toBe(500);

    const history = await coins.listWalletHistory(readerId);
    expect(history[0]).toMatchObject({ kind: 'topup', delta: 500, balance_after: 500 });
  });

  it('журнал неизменяемый: UPDATE и DELETE запрещены триггером', async () => {
    await expect(query('UPDATE coin_transactions SET delta = 999 WHERE user_id = $1', [readerId])).rejects.toThrow();
    await expect(query('DELETE FROM coin_transactions WHERE user_id = $1', [readerId])).rejects.toThrow();
  });

  it('без баланса списание невозможно и ничего не меняет', async () => {
    const poor = await mkUser('economy-poor@test.rs');
    const res = await purchases.purchaseChapterWithCoins(poor, chapterId, { consent: true });
    expect(res).toEqual({ ok: false, error: 'insufficient_coins' });
    expect(await coins.walletBalance(poor)).toBe(0);
  });
});

describe('покупка главы: согласие, списание, возврат', () => {
  it('без согласия покупка не происходит', async () => {
    const res = await purchases.purchaseChapterWithCoins(readerId, chapterId, { consent: false });
    expect(res).toEqual({ ok: false, error: 'consent_required' });
    expect(await coins.walletBalance(readerId)).toBe(500);
  });

  it('с согласием списывает монеты, пишет факт согласия и открывает главу', async () => {
    const res = await purchases.purchaseChapterWithCoins(readerId, chapterId, { consent: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.coins).toBe(15);
      expect(res.balance).toBe(485);
    }
    expect(await coins.walletBalance(readerId)).toBe(485);
    expect(await coins.hasConsent(readerId, chapterId)).toBe(true);

    const consents = await query(
      `SELECT kind, text_version FROM consents WHERE user_id = $1 AND chapter_id = $2`,
      [readerId, chapterId]
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].kind).toBe('paid_chapter_refusal_right');

    const gate = await purchases.chapterGate(
      { id: chapterId, work_id: workId, access: 'paid' }, { uid: readerId, role: 'reader' }
    );
    expect(gate.allowed).toBe(true);
  });

  it('повторная покупка той же главы не списывает второй раз', async () => {
    const res = await purchases.purchaseChapterWithCoins(readerId, chapterId, { consent: true });
    expect(res.ok && res.already).toBe(true);
    expect(await coins.walletBalance(readerId)).toBe(485);
  });

  it('возврат идёт записью в журнал и возвращает баланс', async () => {
    const purchase = await one<{ id: number }>(
      `SELECT id FROM purchases WHERE user_id = $1 AND chapter_id = $2 AND status = 'paid'`,
      [readerId, chapterId]
    );
    await purchases.refundPurchase(purchase!.id);
    expect(await coins.walletBalance(readerId)).toBe(500);

    const refunds = await query(
      `SELECT delta, kind FROM coin_transactions WHERE user_id = $1 AND kind = 'refund'`,
      [readerId]
    );
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].delta)).toBe(15);
  });

  it('лимит расходов в месяц блокирует покупку сверх лимита', async () => {
    await coins.setEconomySettings(readerId, { monthlySpendLimitCoins: 10 });
    const res = await purchases.purchaseChapterWithCoins(readerId, chapter2Id, { consent: true });
    expect(res).toEqual({ ok: false, error: 'monthly_limit_exceeded' });
    expect(await coins.walletBalance(readerId)).toBe(500);
    await coins.setEconomySettings(readerId, { monthlySpendLimitCoins: 0 });
  });

  it('автопокупка выключена по умолчанию, лимит по умолчанию 0 (без лимита)', async () => {
    const s = await coins.getEconomySettings(readerId);
    expect(s.auto_unlock).toBe(false);
    expect(s.monthly_spend_limit_coins).toBe(0);
  });
});

describe('доли: донаты 0%, автор 70/80%, издатель 50%', () => {
  it('донат фанфика и оригинала — 0% по умолчанию, ставка настраивается', () => {
    expect(donations.DEFAULT_FEE_PCT).toBe(0);
    expect(economy.donationFeePctFor('fanfic')).toBe(0);
    expect(economy.donationFeePctFor('original')).toBe(0);
    expect(economy.donationFeePctFor('original', '5')).toBe(5);
  });

  it('автор самиздата: 70% обычно и 80% при эксклюзиве', () => {
    expect(economy.authorSharePct({ exclusivity: false })).toBe(70);
    expect(economy.authorSharePct({ exclusivity: true })).toBe(80);
    expect(royalty.splitRoyalty(990, 30).publisher_cents).toBe(693);
    expect(royalty.splitRoyalty(990, 20).publisher_cents).toBe(792);
  });

  it('издательская книга: комиссия платформы 50% по умолчанию', async () => {
    const pubId = (await one<{ id: number }>(
      `INSERT INTO publishers (name, slug) VALUES ('Ekonomija izdavač', 'ekonomija-izdavac') RETURNING id`
    ))!.id;
    const pub = await one<{ commission_pct: number }>('SELECT commission_pct FROM publishers WHERE id = $1', [pubId]);
    expect(Number(pub!.commission_pct)).toBe(50);
    const split = royalty.splitRoyalty(99000, 50);
    expect(split.commission_cents + split.publisher_cents).toBe(99000);
  });

  it('продажа главы самиздата начисляет автору 70%, при эксклюзиве — 80%', async () => {
    const res = await purchases.purchaseChapterWithCoins(readerId, chapter2Id, { consent: true });
    expect(res.ok).toBe(true);
    const row = await one<{ amount_cents: number; author_cents: number; commission_cents: number }>(
      `SELECT amount_cents, author_cents, commission_cents FROM author_earnings WHERE author_id = $1 ORDER BY id DESC LIMIT 1`,
      [authorId]
    );
    expect(row!.amount_cents).toBe(1500);
    expect(row!.author_cents).toBe(1050); // 70%
    expect(row!.commission_cents).toBe(450); // 30%
  });
});

describe('подписка: тарифы и семейный лимит', () => {
  it('тарифы 699 / 6 990 / 1 199 RSD, семейный — 5 профилей', async () => {
    const plans = await subs.listPlans();
    const byCode = Object.fromEntries(plans.map((p: any) => [p.code, p]));
    expect(Number(byCode.month.price_cents)).toBe(69900);
    expect(Number(byCode.year.price_cents)).toBe(699000);
    expect(Number(byCode.family.price_cents)).toBe(119900);
    expect(Number(byCode.family.max_profiles)).toBe(5);
    expect(byCode.month.currency).toBe('RSD');
  });

  it('в семейной подписке максимум 5 профилей, включая владельца', async () => {
    const owner = await mkUser('family-owner@test.rs');
    await subs.activateSubscription(owner, 'family');

    const invited: number[] = [];
    for (let i = 1; i <= 5; i++) invited.push(await mkUser(`family-member-${i}@test.rs`));

    for (let i = 0; i < 4; i++) {
      const res = await subs.addFamilyMember(owner, invited[i]);
      expect(res.ok).toBe(true);
    }
    const overflow = await subs.addFamilyMember(owner, invited[4]);
    expect(overflow).toEqual({ ok: false, error: 'limit_reached' });

    const members = await subs.familyMembers(owner);
    expect(members).toHaveLength(4);
    // Участник семьи получает доступ по подписке.
    expect(await subs.subscriptionAccess(invited[0])).toBe(true);
  });

  it('отмена сохраняет доступ до конца периода', async () => {
    const owner = await mkUser('family-cancel@test.rs');
    await subs.activateSubscription(owner, 'month');
    const res = await subs.cancelSubscription(owner);
    expect(res.ok).toBe(true);
    expect(await subs.subscriptionAccess(owner)).toBe(true);
    const sub = await subs.activeSubscription(owner);
    expect(sub?.status).toBe('canceled');
  });
});
