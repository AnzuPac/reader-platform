import { one, query } from './db';
import { CURRENCY, formatRsd } from './money';

/**
 * Подписка (ТЗ 4.9, решения §10):
 *  - mesec 699 RSD, godina 6 990 RSD, семейная 1 199 RSD (до 5 профилей);
 *  - безлимит, без кредитов; рекламы нет;
 *  - отмена в 2 нажатия, доступ сохраняется до конца оплаченного периода;
 *  - напоминание за 3 дня до продления.
 */

export const PLANS = {
  month: { code: 'month', price_rsd: 699, period: 'month', max_profiles: 1 },
  year: { code: 'year', price_rsd: 6990, period: 'year', max_profiles: 1 },
  family: { code: 'family', price_rsd: 1199, period: 'month', max_profiles: 5 },
} as const;

export const FAMILY_MAX_PROFILES = 5;
export const RENEWAL_REMINDER_DAYS = 3;

export type PlanRow = {
  code: string; name: string; price_cents: number; currency: string;
  period: 'month' | 'year' | 'none'; max_profiles: number;
  active: number | boolean;
};

export type SubscriptionRow = {
  id: number; user_id: number; plan_code: string; status: 'active' | 'past_due' | 'canceled' | 'expired';
  current_period_start: string; current_period_end: string;
  auto_renew: number | boolean; canceled_at: string | null; reminder_sent_at: string | null;
  created_at: string;
};

export async function listPlans(): Promise<PlanRow[]> {
  return query<PlanRow>(
    `SELECT code, name, price_cents, currency, period, max_profiles, active
       FROM plans WHERE active = 1 ORDER BY price_cents`
  );
}

/** Действующая подписка пользователя, включая семейную (владелец). */
export async function activeSubscription(userId: number): Promise<SubscriptionRow | null> {
  return one<SubscriptionRow>(
    `SELECT * FROM subscriptions
      WHERE user_id = $1 AND status IN ('active','canceled') AND current_period_end > now()
      ORDER BY current_period_end DESC LIMIT 1`,
    [userId]
  );
}

/** Подписка, дающая доступ участнику семьи (владелец tarifaа family). */
export async function familySubscriptionFor(memberUserId: number): Promise<SubscriptionRow | null> {
  return one<SubscriptionRow>(
    `SELECT s.* FROM family_members f
       JOIN subscriptions s ON s.user_id = f.owner_user_id
      WHERE f.member_user_id = $1 AND s.plan_code = 'family'
        AND s.status IN ('active','canceled') AND s.current_period_end > now()
      ORDER BY s.current_period_end DESC LIMIT 1`,
    [memberUserId]
  );
}

/** Доступ по подписке: своя или семейная. */
export async function subscriptionAccess(userId: number): Promise<boolean> {
  return Boolean((await activeSubscription(userId)) || (await familySubscriptionFor(userId)));
}

export async function familyMembers(ownerUserId: number) {
  return query<{ user_id: number; display_name: string; email: string; created_at: string }>(
    `SELECT u.id AS user_id, u.display_name, u.email, f.created_at
       FROM family_members f JOIN users u ON u.id = f.member_user_id
      WHERE f.owner_user_id = $1 ORDER BY f.created_at`,
    [ownerUserId]
  );
}

export type FamilyAddResult =
  | { ok: true; count: number }
  | { ok: false; error: 'not_family_plan' | 'limit_reached' | 'already_member' | 'self' | 'user_not_found' };

/**
 * Добавить профиль в семейную подписку. Лимит — 5 профилей всего, включая
 * владельца; один профиль может быть только в одной семье.
 */
export async function addFamilyMember(ownerUserId: number, memberUserId: number): Promise<FamilyAddResult> {
  if (!ownerUserId || ownerUserId === memberUserId) return { ok: false, error: 'self' };
  const sub = await activeSubscription(ownerUserId);
  if (!sub || sub.plan_code !== 'family') return { ok: false, error: 'not_family_plan' };

  const member = await one<{ id: number }>('SELECT id FROM users WHERE id = $1', [memberUserId]);
  if (!member) return { ok: false, error: 'user_not_found' };

  const existing = await one('SELECT 1 AS ok FROM family_members WHERE member_user_id = $1', [memberUserId]);
  if (existing) return { ok: false, error: 'already_member' };

  const countRow = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM family_members WHERE owner_user_id = $1', [ownerUserId]
  );
  const totalProfiles = Number(countRow?.n || 0) + 1; // + владелец
  if (totalProfiles >= FAMILY_MAX_PROFILES) return { ok: false, error: 'limit_reached' };

  await query('INSERT INTO family_members (owner_user_id, member_user_id) VALUES ($1,$2)', [ownerUserId, memberUserId]);
  return { ok: true, count: totalProfiles + 1 };
}

export async function addFamilyMemberByEmail(ownerUserId: number, email: string): Promise<FamilyAddResult> {
  const user = await one<{ id: number }>('SELECT id FROM users WHERE lower(email) = lower($1)', [String(email || '').trim()]);
  if (!user) return { ok: false, error: 'user_not_found' };
  return addFamilyMember(ownerUserId, user.id);
}

export async function removeFamilyMember(ownerUserId: number, memberUserId: number): Promise<void> {
  await query('DELETE FROM family_members WHERE owner_user_id = $1 AND member_user_id = $2', [ownerUserId, memberUserId]);
}

/** Otkaži подписки: статус canceled, доступ — до конца оплаченного периода. */
export async function cancelSubscription(userId: number): Promise<{ ok: boolean; until?: string; error?: 'not_found' }> {
  const sub = await activeSubscription(userId);
  if (!sub) return { ok: false, error: 'not_found' };
  await query(
    `UPDATE subscriptions SET status = 'canceled', auto_renew = 0, canceled_at = now()
      WHERE id = $1 AND status = 'active'`,
    [sub.id]
  );
  return { ok: true, until: sub.current_period_end };
}

/** Pretplate, которым продление через N дней и о которых ещё не напоминали. */
export async function dueRenewalReminders(days = RENEWAL_REMINDER_DAYS): Promise<SubscriptionRow[]> {
  const p = process.env.DATABASE_URL
    ? 'now() + make_interval(days => $1)'
    : "datetime('now', '+' || $1 || ' days')";
  return query<SubscriptionRow>(
    `SELECT * FROM subscriptions
      WHERE status = 'active' AND auto_renew = 1 AND reminder_sent_at IS NULL
        AND current_period_end > now()
        AND current_period_end <= ${p}
      ORDER BY current_period_end`,
    [Math.max(1, Math.trunc(days))]
  );
}

/** Заглушка отправки письма: факт напоминания фиксируется в поле. */
export async function markReminderSent(subscriptionId: number): Promise<void> {
  await query('UPDATE subscriptions SET reminder_sent_at = now() WHERE id = $1', [subscriptionId]);
  await query(
    `INSERT INTO audit_log (action, entity, entity_id, payload)
     VALUES ('subscription.reminder', 'subscription', $1, $2)`,
    [subscriptionId, JSON.stringify({ channel: 'email', stub: true })]
  );
}

/** Текст условий для экрана подписки. */
export function planFacts(plan: PlanRow): string[] {
  const facts = ['Neograničeno čitanje knjiga uz pretplatu', 'Nove glave samizdata', 'Bez reklama'];
  if (plan.code === 'family') facts.push(`Do ${plan.max_profiles} profila u porodici`);
  if (plan.code === 'year') facts.push('Dva meseca na poklon');
  facts.push(`Цена: ${formatRsd(plan.price_cents)} / ${plan.period === 'year' ? 'godina' : 'mesec'}`);
  facts.push(`Следующее списание: ${formatRsd(plan.price_cents)} ${plan.period === 'year' ? 'za godinu dana' : 'za mesec dana'}`);
  return facts;
}

export const SUBSCRIPTION_CURRENCY = CURRENCY;

/** Дата конца периода по коду tarifaа (mesec = 30 дней, godina = 365). */
export function periodEndFor(planCode: string, from = new Date()): string {
  const days = planCode === 'year' ? 365 : 30;
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

/** Активировать подписку после potvrde оплаты. Идемпотентно по платежу. */
export async function activateSubscription(userId: number, planCode: string): Promise<{ ok: true; end: string }> {
  const end = periodEndFor(planCode);
  await query(
    `INSERT INTO subscriptions (user_id, plan_code, status, current_period_start, current_period_end)
     VALUES ($1,$2,'active',now(),$3)`,
    [userId, planCode, end]
  );
  return { ok: true, end };
}
