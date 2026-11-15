import { one, query, withTx, type Tx } from './db';

/**
 * Кошелёк читателя: монеты (1 монета = 1 RSD).
 *
 * Инварианты:
 *  - монеты не сгорают, срок жизни не ограничен;
 *  - каждое движение пишется в coin_transactions (append-only, триггеры в схеме);
 *  - баланс меняется только вместе с записью журнала — в одной транзакции;
 *  - списание невозможно ниже нуля: UPDATE ... WHERE balance_coins >= N;
 *  - возврат (отмена/ошибка) — отдельная запись kind='refund', журнал не правится.
 */

export type CoinKind = 'topup' | 'spend' | 'refund' | 'bonus';

export type CoinTxRow = {
  id: number; user_id: number; delta: number; kind: CoinKind;
  ref_id: string | null; balance_after: number; created_at: string;
};

export type CoinPackage = { code: string; coins: number; price_rsd: number; bonus_coins: number };

export type CoinOrderRow = {
  id: number; user_id: number; package_code: string; coins: number; price_rsd: number;
  status: 'pending' | 'paid' | 'canceled'; provider: 'manual' | 'stripe';
  external_id: string | null; created_at: string; paid_at: string | null;
};

async function runIn<T>(tx: Tx | undefined, fn: (t: Tx) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : withTx(fn);
}

async function ensureWalletRow(t: Tx, userId: number): Promise<void> {
  await t.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
}

export async function ensureWallet(userId: number): Promise<number> {
  return runIn(undefined, async (t) => {
    await ensureWalletRow(t, userId);
    const row = await t.one<{ balance_coins: number }>('SELECT balance_coins FROM wallets WHERE user_id = $1', [userId]);
    return Number(row?.balance_coins || 0);
  });
}

export async function walletBalance(userId: number): Promise<number> {
  const row = await one<{ balance_coins: number }>('SELECT balance_coins FROM wallets WHERE user_id = $1', [userId]);
  return Number(row?.balance_coins || 0);
}

export async function listWalletHistory(userId: number, limit = 50): Promise<CoinTxRow[]> {
  const n = Math.max(1, Math.min(200, Math.trunc(limit)));
  return query<CoinTxRow>(
    `SELECT id, user_id, delta, kind, ref_id, balance_after, created_at
       FROM coin_transactions WHERE user_id = $1
      ORDER BY id DESC LIMIT ${n}`,
    [userId]
  );
}

/** Начисление монет: пополнение, бонус или возврат. Возвращает новый баланс. */
export async function creditCoins(
  userId: number,
  coins: number,
  kind: CoinKind = 'topup',
  refId: string | null = null,
  tx?: Tx
): Promise<{ ok: true; balance: number } | { ok: false; error: 'invalid_amount' }> {
  const amount = Math.trunc(Number(coins) || 0);
  if (amount <= 0) return { ok: false, error: 'invalid_amount' };

  return runIn(tx, async (t) => {
    await ensureWalletRow(t, userId);
    const rows = await t.query<{ balance_coins: number }>(
      `UPDATE wallets SET balance_coins = balance_coins + $2, updated_at = now()
        WHERE user_id = $1 RETURNING balance_coins`,
      [userId, amount]
    );
    const balance = Number(rows[0]?.balance_coins || 0);
    await t.query(
      'INSERT INTO coin_transactions (user_id, delta, kind, ref_id, balance_after) VALUES ($1,$2,$3,$4,$5)',
      [userId, amount, kind, refId, balance]
    );
    return { ok: true as const, balance };
  });
}

/** Списание монет. Недостаточно средств — ничего не меняется. */
export async function debitCoins(
  userId: number,
  coins: number,
  refId: string | null = null,
  tx?: Tx
): Promise<{ ok: true; balance: number } | { ok: false; error: 'invalid_amount' | 'insufficient_coins' }> {
  const amount = Math.trunc(Number(coins) || 0);
  if (amount <= 0) return { ok: false, error: 'invalid_amount' };

  return runIn(tx, async (t) => {
    await ensureWalletRow(t, userId);
    const rows = await t.query<{ balance_coins: number }>(
      `UPDATE wallets SET balance_coins = balance_coins - $2, updated_at = now()
        WHERE user_id = $1 AND balance_coins >= $2 RETURNING balance_coins`,
      [userId, amount]
    );
    if (!rows.length) return { ok: false as const, error: 'insufficient_coins' as const };
    const balance = Number(rows[0].balance_coins);
    await t.query(
      'INSERT INTO coin_transactions (user_id, delta, kind, ref_id, balance_after) VALUES ($1,$2,$3,$4,$5)',
      [userId, -amount, 'spend', refId, balance]
    );
    return { ok: true as const, balance };
  });
}

/** Возврат монет за отменённую/ошибочную покупку — записью в журнал. */
export async function refundCoins(userId: number, coins: number, refId: string | null = null): Promise<{ balance: number }> {
  const res = await creditCoins(userId, coins, 'refund', refId);
  return { balance: res.ok ? res.balance : await walletBalance(userId) };
}

export async function listCoinPackages(): Promise<CoinPackage[]> {
  return query<CoinPackage>(
    'SELECT code, coins, price_rsd, bonus_coins FROM coin_packages WHERE active = 1 ORDER BY coins'
  );
}

export async function getCoinPackage(code: string): Promise<CoinPackage | null> {
  return one<CoinPackage>(
    'SELECT code, coins, price_rsd, bonus_coins FROM coin_packages WHERE code = $1 AND active = 1', [code]
  );
}

/** Заявка на пополнение: Stripe Checkout или ручное подтверждение админом. */
export async function createCoinOrder(
  userId: number,
  packageCode: string,
  provider: 'manual' | 'stripe' = 'manual'
): Promise<{ ok: true; order: CoinOrderRow } | { ok: false; error: 'package_not_found' | 'invalid_user' }> {
  if (!userId) return { ok: false, error: 'invalid_user' };
  const pack = await getCoinPackage(packageCode);
  if (!pack) return { ok: false, error: 'package_not_found' };
  const rows = await query<{ id: number }>(
    `INSERT INTO coin_orders (user_id, package_code, coins, price_rsd, status, provider)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
    [userId, pack.code, pack.coins + pack.bonus_coins, pack.price_rsd, provider]
  );
  const order = await one<CoinOrderRow>('SELECT * FROM coin_orders WHERE id = $1', [rows[0].id]);
  return { ok: true, order: order as CoinOrderRow };
}

export async function attachCoinOrderCheckout(orderId: number, externalId: string): Promise<void> {
  await query("UPDATE coin_orders SET provider = 'stripe', external_id = $2 WHERE id = $1", [orderId, externalId]);
}

/** Подтверждение оплаты пакета. Идемпотентно: повторно монеты не начисляются. */
export async function markCoinOrderPaid(
  orderId: number,
  externalId?: string | null
): Promise<{ ok: true; already: boolean; coins: number; balance: number } | { ok: false; error: 'not_found' | 'canceled' }> {
  const order = await one<CoinOrderRow>('SELECT * FROM coin_orders WHERE id = $1', [orderId]);
  if (!order) return { ok: false, error: 'not_found' };
  if (order.status === 'canceled') return { ok: false, error: 'canceled' };

  return withTx(async (t) => {
    const fresh = await t.one<CoinOrderRow>('SELECT * FROM coin_orders WHERE id = $1', [orderId]);
    if (!fresh) return { ok: false as const, error: 'not_found' as const };
    if (fresh.status === 'paid') {
      const bal = await t.one<{ balance_coins: number }>('SELECT balance_coins FROM wallets WHERE user_id = $1', [fresh.user_id]);
      return { ok: true as const, already: true, coins: 0, balance: Number(bal?.balance_coins || 0) };
    }
    await t.query(
      `UPDATE coin_orders SET status = 'paid', paid_at = now(), external_id = COALESCE($2, external_id)
        WHERE id = $1 AND status = 'pending'`,
      [orderId, externalId ?? null]
    );
    const credited = await creditCoins(fresh.user_id, fresh.coins, 'topup', `order:${orderId}`, t);
    return {
      ok: true as const,
      already: false,
      coins: fresh.coins,
      balance: credited.ok ? credited.balance : 0,
    };
  });
}

export type EconomySettings = { auto_unlock: boolean; monthly_spend_limit_coins: number };

export async function getEconomySettings(userId: number): Promise<EconomySettings> {
  const row = await one<{ auto_unlock: number | boolean; monthly_spend_limit_coins: number }>(
    'SELECT auto_unlock, monthly_spend_limit_coins FROM user_economy_settings WHERE user_id = $1', [userId]
  );
  return {
    auto_unlock: Boolean(row?.auto_unlock),
    monthly_spend_limit_coins: Number(row?.monthly_spend_limit_coins || 0),
  };
}

export async function setEconomySettings(
  userId: number,
  patch: { autoUnlock?: boolean; monthlySpendLimitCoins?: number }
): Promise<EconomySettings> {
  const current = await getEconomySettings(userId);
  const auto = patch.autoUnlock === undefined ? current.auto_unlock : Boolean(patch.autoUnlock);
  const limit = patch.monthlySpendLimitCoins === undefined
    ? current.monthly_spend_limit_coins
    : Math.max(0, Math.trunc(Number(patch.monthlySpendLimitCoins) || 0));
  await query(
    `INSERT INTO user_economy_settings (user_id, auto_unlock, monthly_spend_limit_coins, updated_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (user_id) DO UPDATE SET
       auto_unlock = EXCLUDED.auto_unlock,
       monthly_spend_limit_coins = EXCLUDED.monthly_spend_limit_coins,
       updated_at = now()`,
    [userId, auto ? 1 : 0, limit]
  );
  return { auto_unlock: auto, monthly_spend_limit_coins: limit };
}

/** Расход монет за текущий календарный месяц (для лимита). */
export async function monthlySpendCoins(userId: number, tx?: Tx): Promise<number> {
  const monthFilter = process.env.DATABASE_URL
    ? "created_at >= date_trunc('month', now())"
    : "substr(created_at, 1, 7) = strftime('%Y-%m', 'now')";
  const sql = `SELECT COALESCE(SUM(-delta), 0) AS spent FROM coin_transactions
                WHERE user_id = $1 AND kind = 'spend' AND ${monthFilter}`;
  const row = tx
    ? await tx.one<{ spent: number }>(sql, [userId])
    : await one<{ spent: number }>(sql, [userId]);
  return Number(row?.spent || 0);
}

/** Проверка лимита расходов перед списанием. Лимит 0 = не задан. */
export async function checkSpendLimit(
  userId: number,
  coins: number,
  tx?: Tx
): Promise<{ ok: true } | { ok: false; error: 'monthly_limit_exceeded'; limit: number; spent: number }> {
  const settings = await getEconomySettings(userId);
  const limit = settings.monthly_spend_limit_coins;
  if (limit <= 0) return { ok: true };
  const spent = await monthlySpendCoins(userId, tx);
  if (spent + Math.trunc(coins) > limit) {
    return { ok: false, error: 'monthly_limit_exceeded', limit, spent };
  }
  return { ok: true };
}

export async function recordConsent(
  userId: number,
  kind: 'paid_chapter_refusal_right' | 'terms',
  target: { workId?: number | null; chapterId?: number | null } = {},
  tx?: Tx
): Promise<void> {
  const t = tx;
  const sql = `INSERT INTO consents (user_id, kind, work_id, chapter_id, text_version)
               VALUES ($1,$2,$3,$4,'v0.2')`;
  const params = [userId, kind, target.workId ?? null, target.chapterId ?? null];
  if (t) await t.query(sql, params);
  else await query(sql, params);
}

export async function hasConsent(userId: number, chapterId: number): Promise<boolean> {
  const row = await one(
    `SELECT 1 AS ok FROM consents
      WHERE user_id = $1 AND chapter_id = $2 AND kind = 'paid_chapter_refusal_right' LIMIT 1`,
    [userId, chapterId]
  );
  return !!row;
}
