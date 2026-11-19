import { one, query } from './db';
import { calcAge, parseBirthDate } from './age';

/**
 * Подарки на день рождения.
 *
 * Правила: подарок только в день рождения (по дате профиля), один раз в год,
 * только по явному действию пользователя (никаких автоначислений), всё
 * журналируется. Конфигурация живёт в app_settings под ключом `birthday_gift`,
 * поэтому сумму можно менять без миграции.
 */

export type BirthdayGiftConfig = {
  enabled: boolean;
  coins: number;
  /** Сколько дней после дня рождения подарок ещё доступен. */
  graceDays: number;
};

export const DEFAULT_GIFT: BirthdayGiftConfig = { enabled: false, coins: 0, graceDays: 3 };

export async function getGiftConfig(): Promise<BirthdayGiftConfig> {
  const row = await one<{ value: unknown }>("SELECT value FROM app_settings WHERE key = 'birthday_gift'");
  const raw = row?.value;
  const parsed = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_GIFT };
  const obj = parsed as Record<string, unknown>;
  return {
    enabled: obj.enabled === true || obj.enabled === 1 || obj.enabled === 'true',
    coins: Math.max(0, Math.min(10_000, Math.floor(Number(obj.coins) || 0))),
    graceDays: Math.max(0, Math.min(30, Math.floor(Number(obj.graceDays) || DEFAULT_GIFT.graceDays))),
  };
}

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}

/** Сколько дней осталось до/после дня рождения в пределах окна подарка. */
export function giftWindow(birthDate: string, now: Date, graceDays: number): { inWindow: boolean; daysUntil: number } {
  const birth = parseBirthDate(birthDate.slice(0, 10), now);
  if (!birth) return { inWindow: false, daysUntil: 0 };

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let next = Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  // 29 февраля в невисокосный год — празднуем 28-го.
  if (birth.getUTCMonth() === 1 && birth.getUTCDate() === 29 && new Date(next).getUTCMonth() !== 1) {
    next = Date.UTC(now.getUTCFullYear(), 1, 28);
  }
  const daysUntil = Math.round((next - today) / 86_400_000);
  return { inWindow: daysUntil <= 0 && daysUntil >= -graceDays, daysUntil };
}

export type GiftStatus = {
  config: BirthdayGiftConfig;
  eligible: boolean;
  claimedThisYear: boolean;
  daysUntilBirthday: number | null;
  hasBirthDate: boolean;
};

export async function giftStatus(userId: number, now = new Date()): Promise<GiftStatus> {
  const config = await getGiftConfig();
  const user = await one<{ birth_date: string | null }>('SELECT birth_date FROM users WHERE id = $1', [userId]);
  const birthDate = user?.birth_date || null;

  if (!birthDate) {
    return { config, eligible: false, claimedThisYear: false, daysUntilBirthday: null, hasBirthDate: false };
  }

  const year = now.getUTCFullYear();
  const claimed = await one<{ id: number }>(
    'SELECT id FROM birthday_gifts WHERE user_id = $1 AND gift_year = $2', [userId, year],
  );
  const win = giftWindow(birthDate, now, config.graceDays);

  return {
    config,
    eligible: config.enabled && config.coins > 0 && win.inWindow && !claimed,
    claimedThisYear: Boolean(claimed),
    daysUntilBirthday: win.daysUntil,
    hasBirthDate: true,
  };
}

export type ClaimResult =
  | { ok: true; coins: number }
  | { ok: false; reason: 'disabled' | 'no_birth_date' | 'not_today' | 'already_claimed' };

/** Начисление подарка: атомарно по (user_id, year), повторно не выдаётся. */
export async function claimGift(userId: number, now = new Date()): Promise<ClaimResult> {
  const status = await giftStatus(userId, now);
  if (!status.config.enabled || status.config.coins <= 0) return { ok: false, reason: 'disabled' };
  if (!status.hasBirthDate) return { ok: false, reason: 'no_birth_date' };
  if (status.claimedThisYear) return { ok: false, reason: 'already_claimed' };
  if (!status.eligible) return { ok: false, reason: 'not_today' };

  const year = now.getUTCFullYear();
  const inserted = await query<{ id: number }>(
    'INSERT INTO birthday_gifts (user_id, gift_year, coins, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, year, status.config.coins, new Date().toISOString()],
  ).catch(() => [] as { id: number }[]);
  if (!inserted.length) return { ok: false, reason: 'already_claimed' };

  const { creditCoins } = await import('./coins');
  const res = await creditCoins(userId, status.config.coins, 'bonus', `birthday_${year}`);
  if (!res.ok) return { ok: false, reason: 'already_claimed' };
  return { ok: true, coins: status.config.coins };
}

/** Возраст для внутренних проверок (не для показа). */
export async function userAge(userId: number, now = new Date()): Promise<number | null> {
  const user = await one<{ birth_date: string | null }>('SELECT birth_date FROM users WHERE id = $1', [userId]);
  if (!user?.birth_date) return null;
  const birth = parseBirthDate(String(user.birth_date).slice(0, 10), now);
  return birth ? calcAge(birth, now) : null;
}
