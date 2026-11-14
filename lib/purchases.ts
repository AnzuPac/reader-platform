import { one, query } from './db';
import { decideChapterAccess, type GateResult } from './access';
import { splitRoyalty } from './royalty';

/**
 * Покупки книг и глав.
 *
 * Инварианты:
 *  - сумма покупки фиксируется в момент создания (цена может измениться позже);
 *  - одна цель — одна активная покупка (pending/paid) на пользователя;
 *  - подтверждение оплаты идемпотентно: повторный вызов не задваивает
 *    entitlement и не пишет второй раз в royalty_ledger;
 *  - доступ после оплаты — навсегда (expires_at = NULL).
 */

export type PurchaseRow = {
  id: number;
  user_id: number;
  work_id: number | null;
  chapter_id: number | null;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded';
  provider: 'manual' | 'stripe';
  external_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type Price = { amount_cents: number; currency: string };

export type PurchaseTarget = {
  workId: number;
  chapterId: number | null;
  amount_cents: number;
  currency: string;
  title: string;
  slug: string;
};

export type StartResult =
  | { ok: true; purchase: PurchaseRow; already: boolean; target: PurchaseTarget }
  | { ok: false; error: 'not_for_sale' | 'work_not_found' | 'chapter_not_found' | 'bad_target' };

type WorkRow = {
  id: number; slug: string; title: string; status: string; type: string;
  publisher_id: number | null; author_id: number;
};

type ChapterRow = {
  id: number; work_id: number; number: number; title: string;
  access: string; price_cents: number; status: string;
};

export async function workPrice(workId: number): Promise<Price | null> {
  return one<Price>(
    'SELECT amount_cents, currency FROM book_prices WHERE work_id = $1 AND active = 1',
    [workId]
  );
}

/** Цена одной главы (комиксы/отдельные главы). Валюта — валюта книги, иначе EUR. */
export async function chapterPrice(chapterId: number): Promise<Price | null> {
  const ch = await one<ChapterRow>(
    'SELECT id, work_id, number, title, access, price_cents, status FROM chapters WHERE id = $1',
    [chapterId]
  );
  if (!ch || ch.access !== 'paid') return null;
  return effectiveChapterPrice(ch);
}

/**
 * Действующая цена главы: chapter_prices (если задана и активна), иначе
 * chapters.price_cents — историческое поле, оставленное для совместимости.
 * Валюта — из chapter_prices, иначе валюта книги, иначе EUR.
 */
export async function effectiveChapterPrice(ch: {
  id: number; work_id: number; price_cents: number;
}): Promise<Price | null> {
  const cp = await one<{ amount_cents: number; currency: string }>(
    'SELECT amount_cents, currency FROM chapter_prices WHERE chapter_id = $1 AND active = 1',
    [ch.id]
  );
  const amount = Math.trunc(Number(cp ? cp.amount_cents : ch.price_cents) || 0);
  if (amount <= 0) return null;
  const currency = cp?.currency || (await workPrice(ch.work_id))?.currency || 'EUR';
  return { amount_cents: amount, currency };
}

/** Задать цену главы (кабинет автора/издателя). Идемпотентно. */
export async function setChapterPrice(
  chapterId: number,
  amountCents: number,
  currency?: string,
  active = true
): Promise<{ ok: boolean; error?: 'invalid_amount' | 'invalid_currency' | 'not_found' }> {
  const amount = Math.trunc(Number(amountCents));
  if (!Number.isInteger(amount) || amount < 0) return { ok: false, error: 'invalid_amount' };
  const ch = await one<{ id: number; work_id: number }>('SELECT id, work_id FROM chapters WHERE id = $1', [chapterId]);
  if (!ch) return { ok: false, error: 'not_found' };

  const fallback = (await workPrice(ch.work_id))?.currency || 'EUR';
  const cur = String(currency || fallback).toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(cur)) return { ok: false, error: 'invalid_currency' };

  await query(
    `INSERT INTO chapter_prices (chapter_id, amount_cents, currency, active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (chapter_id) DO UPDATE SET
       amount_cents = EXCLUDED.amount_cents,
       currency = EXCLUDED.currency,
       active = EXCLUDED.active,
       updated_at = now()`,
    [chapterId, amount, cur, active ? 1 : 0]
  );
  await query('UPDATE chapters SET price_cents = $2 WHERE id = $1', [chapterId, amount]);
  return { ok: true };
}

export async function resolveTarget(input: { workId?: number | null; chapterId?: number | null }): Promise<
  { ok: true; target: PurchaseTarget }
  | { ok: false; error: 'not_for_sale' | 'work_not_found' | 'chapter_not_found' | 'bad_target' }
> {
  const workId = Number(input.workId) || null;
  const chapterId = Number(input.chapterId) || null;

  if (chapterId) {
    const ch = await one<ChapterRow>(
      'SELECT id, work_id, number, title, access, price_cents, status FROM chapters WHERE id = $1',
      [chapterId]
    );
    if (!ch || ch.status !== 'published') return { ok: false, error: 'chapter_not_found' };
    if (ch.access !== 'paid') return { ok: false, error: 'not_for_sale' };
    const price = await effectiveChapterPrice(ch);
    if (!price) return { ok: false, error: 'not_for_sale' };
    const w = await one<WorkRow>(
      'SELECT id, slug, title, status, type, publisher_id, author_id FROM works WHERE id = $1', [ch.work_id]
    );
    if (!w || w.status !== 'published') return { ok: false, error: 'work_not_found' };
    return {
      ok: true,
      target: {
        workId: w.id,
        chapterId: ch.id,
        amount_cents: price.amount_cents,
        currency: price.currency,
        title: `${w.title} — ${ch.title || `Glava ${ch.number}`}`,
        slug: w.slug,
      },
    };
  }

  if (!workId) return { ok: false, error: 'bad_target' };
  const w = await one<WorkRow>(
    'SELECT id, slug, title, status, type, publisher_id, author_id FROM works WHERE id = $1', [workId]
  );
  if (!w || w.status !== 'published') return { ok: false, error: 'work_not_found' };
  const price = await workPrice(w.id);
  if (!price || price.amount_cents <= 0) return { ok: false, error: 'not_for_sale' };
  return {
    ok: true,
    target: {
      workId: w.id,
      chapterId: null,
      amount_cents: price.amount_cents,
      currency: price.currency,
      title: w.title,
      slug: w.slug,
    },
  };
}

async function findActivePurchase(userId: number, workId: number, chapterId: number | null): Promise<PurchaseRow | null> {
  return one<PurchaseRow>(
    `SELECT * FROM purchases
      WHERE user_id = $1 AND work_id = $2
        AND ((chapter_id IS NULL AND $3 IS NULL) OR chapter_id = $3)
        AND status IN ('pending','paid')
      ORDER BY CASE status WHEN 'paid' THEN 0 ELSE 1 END, id
      LIMIT 1`,
    [userId, workId, chapterId]
  );
}

export async function startPurchase(
  userId: number,
  input: { workId?: number | null; chapterId?: number | null },
  provider: 'manual' | 'stripe' = 'manual'
): Promise<StartResult> {
  const resolved = await resolveTarget(input);
  if (!resolved.ok) return resolved;
  const t = resolved.target;

  const existing = await findActivePurchase(userId, t.workId, t.chapterId);
  if (existing) {
    return { ok: true, purchase: existing, already: existing.status === 'paid', target: t };
  }

  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO purchases (user_id, work_id, chapter_id, amount_cents, currency, status, provider)
       VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id`,
      [userId, t.workId, t.chapterId, t.amount_cents, t.currency, provider]
    );
    const purchase = await one<PurchaseRow>('SELECT * FROM purchases WHERE id = $1', [rows[0].id]);
    return { ok: true, purchase: purchase as PurchaseRow, already: false, target: t };
  } catch (e) {
    // Гонка: параллельный запрос уже создал активную покупку (partial unique index).
    const again = await findActivePurchase(userId, t.workId, t.chapterId);
    if (again) return { ok: true, purchase: again, already: again.status === 'paid', target: t };
    throw e;
  }
}

export async function attachCheckoutSession(purchaseId: number, externalId: string): Promise<void> {
  await query("UPDATE purchases SET provider = 'stripe', external_id = $2 WHERE id = $1", [purchaseId, externalId]);
}

export type RoyaltyAccrual = { publisher_id: number; commission_cents: number; publisher_cents: number };

export type PaidResult =
  | { ok: true; purchase: PurchaseRow; already: boolean; royalty: RoyaltyAccrual | null }
  | { ok: false; error: 'not_found' | 'refunded' };

/**
 * Подтверждение оплаты. Единственная точка, где покупка становится paid,
 * выдаётся доступ и начисляется роялти издателю.
 */
export async function markPurchasePaid(purchaseId: number, externalId?: string | null): Promise<PaidResult> {
  const p = await one<PurchaseRow>('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
  if (!p) return { ok: false, error: 'not_found' };
  if (p.status === 'paid') return { ok: true, purchase: p, already: true, royalty: null };
  if (p.status === 'refunded') return { ok: false, error: 'refunded' };

  await query(
    `UPDATE purchases
        SET status = 'paid', paid_at = now(), external_id = COALESCE($2, external_id)
      WHERE id = $1 AND status = 'pending'`,
    [purchaseId, externalId ?? null]
  );

  const targetType = p.chapter_id ? 'chapter' : 'work';
  const targetId = p.chapter_id ?? p.work_id;
  if (targetId) {
    await query(
      `INSERT INTO entitlements (user_id, target_type, target_id, source)
       VALUES ($1,$2,$3,'purchase')
       ON CONFLICT DO NOTHING`,
      [p.user_id, targetType, targetId]
    );
  }

  let royalty: RoyaltyAccrual | null = null;
  const publisherId = p.work_id
    ? (await one<{ publisher_id: number | null }>('SELECT publisher_id FROM works WHERE id = $1', [p.work_id]))?.publisher_id
    : null;

  if (p.work_id && publisherId) {
    const pub = await one<{ commission_pct: number }>(
      'SELECT commission_pct FROM publishers WHERE id = $1', [publisherId]
    );
    if (pub) {
      const split = splitRoyalty(p.amount_cents, pub.commission_pct);
      await query(
        `INSERT INTO royalty_ledger (publisher_id, work_id, purchase_id, amount_cents, commission_cents, status)
         VALUES ($1,$2,$3,$4,$5,'accrued')
         ON CONFLICT (purchase_id) DO NOTHING`,
        [publisherId, p.work_id, p.id, split.amount_cents, split.commission_cents]
      );
      royalty = {
        publisher_id: publisherId,
        commission_cents: split.commission_cents,
        publisher_cents: split.publisher_cents,
      };
    }
  }

  const fresh = await one<PurchaseRow>('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
  return { ok: true, purchase: fresh as PurchaseRow, already: false, royalty };
}

export async function refundPurchase(purchaseId: number): Promise<{ ok: boolean; error?: string }> {
  const p = await one<PurchaseRow>('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
  if (!p) return { ok: false, error: 'not_found' };
  if (p.status !== 'paid') return { ok: false, error: 'not_paid' };

  await query("UPDATE purchases SET status = 'refunded' WHERE id = $1", [purchaseId]);
  await query('DELETE FROM royalty_ledger WHERE purchase_id = $1', [purchaseId]);
  const targetType = p.chapter_id ? 'chapter' : 'work';
  const targetId = p.chapter_id ?? p.work_id;
  if (targetId) {
    await query(
      `DELETE FROM entitlements WHERE user_id = $1 AND target_type = $2 AND target_id = $3 AND source = 'purchase'`,
      [p.user_id, targetType, targetId]
    );
  }
  return { ok: true };
}

export async function hasActiveSubscription(userId: number): Promise<boolean> {
  const row = await one(
    "SELECT 1 AS ok FROM subscriptions WHERE user_id = $1 AND status = 'active' AND current_period_end > now() LIMIT 1",
    [userId]
  );
  return !!row;
}

export async function hasWorkPurchase(userId: number, workId: number): Promise<boolean> {
  const row = await one(
    "SELECT 1 AS ok FROM purchases WHERE user_id = $1 AND work_id = $2 AND chapter_id IS NULL AND status = 'paid' LIMIT 1",
    [userId, workId]
  );
  return !!row;
}

export async function hasChapterPurchase(userId: number, chapterId: number): Promise<boolean> {
  const row = await one(
    "SELECT 1 AS ok FROM purchases WHERE user_id = $1 AND chapter_id = $2 AND status = 'paid' LIMIT 1",
    [userId, chapterId]
  );
  return !!row;
}

/** Куплена ли книга целиком (покупка или выданный доступ на произведение). */
export async function hasWorkAccess(userId: number, workId: number): Promise<boolean> {
  const row = await one(
    `SELECT 1 AS ok FROM entitlements
      WHERE user_id = $1 AND target_type = 'work' AND target_id = $2 LIMIT 1`,
    [userId, workId]
  );
  if (row) return true;
  return hasWorkPurchase(userId, workId);
}

export async function hasEntitlement(userId: number, workId: number, chapterId: number): Promise<boolean> {
  const row = await one(
    `SELECT 1 AS ok FROM entitlements
      WHERE user_id = $1 AND ((target_type = 'chapter' AND target_id = $2)
                           OR (target_type = 'work' AND target_id = $3)) LIMIT 1`,
    [userId, chapterId, workId]
  );
  return !!row;
}

/** Решение о доступе к главе с учётом покупок, подписки и ролей. */
export async function chapterGate(
  chapter: { id: number; work_id: number; access: string },
  session: { uid: number; role: string } | null
): Promise<GateResult> {
  if (chapter.access === 'free') return { allowed: true, reason: 'free' };
  if (!session) {
    return decideChapterAccess({
      access: chapter.access, loggedIn: false, isAuthor: false, isAdmin: false,
      hasSubscription: false, hasWorkPurchase: false, hasChapterPurchase: false, hasEntitlement: false,
    });
  }

  const work = await one<{ author_id: number }>('SELECT author_id FROM works WHERE id = $1', [chapter.work_id]);
  const [sub, workBuy, chapterBuy, ent] = await Promise.all([
    hasActiveSubscription(session.uid),
    hasWorkPurchase(session.uid, chapter.work_id),
    hasChapterPurchase(session.uid, chapter.id),
    hasEntitlement(session.uid, chapter.work_id, chapter.id),
  ]);

  return decideChapterAccess({
    access: chapter.access,
    loggedIn: true,
    isAuthor: work?.author_id === session.uid,
    isAdmin: session.role === 'admin',
    hasSubscription: sub,
    hasWorkPurchase: workBuy,
    hasChapterPurchase: chapterBuy,
    hasEntitlement: ent,
  });
}

/** «Kupljeno»: произведения, оплаченные пользователем (книга или хотя бы глава). */
export async function listPurchasedWorks(userId: number) {
  return query<{
    id: number; slug: string; title: string; description: string; cover_path: string | null;
    author_name: string; purchased_at: string; chapter_only: number;
  }>(
    `SELECT w.id, w.slug, w.title, w.description, w.cover_path,
            u.display_name AS author_name,
            MAX(p.paid_at) AS purchased_at,
            CASE WHEN MAX(CASE WHEN p.chapter_id IS NULL THEN 1 ELSE 0 END) = 1 THEN 0 ELSE 1 END AS chapter_only
       FROM purchases p
       JOIN works w ON w.id = p.work_id
       JOIN users u ON u.id = w.author_id
      WHERE p.user_id = $1 AND p.status = 'paid' AND w.status = 'published'
      GROUP BY w.id, w.slug, w.title, w.description, w.cover_path, u.display_name
      ORDER BY MAX(p.paid_at) DESC`,
    [userId]
  );
}
