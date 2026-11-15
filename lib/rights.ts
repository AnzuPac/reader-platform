/** Права по книге (ТЗ 6.1): продажа, подписка с «окном» новинки, регионы, TTS. */

export type WorkRights = {
  rights_sale: number;
  rights_subscription: number;
  subscription_window_days: number;
  regions: string;
  tts_allowed: number;
  free_excerpt_pct: number;
  published_at: string | null;
};

/** Доступна ли книга в подписке сейчас: право включено и окно новинки истекло. */
export function subscriptionAvailable(w: Pick<WorkRights, 'rights_subscription' | 'subscription_window_days' | 'published_at'>, now = Date.now()): boolean {
  if (Number(w.rights_subscription) !== 1) return false;
  const days = Number(w.subscription_window_days) || 0;
  if (days <= 0) return true;
  if (!w.published_at) return true;
  const published = Date.parse(w.published_at);
  if (!Number.isFinite(published)) return true;
  return now >= published + days * 86_400_000;
}

/** Разрешена ли продажа книги навсегда. */
export function saleAvailable(w: Pick<WorkRights, 'rights_sale'>): boolean {
  return Number(w.rights_sale) === 1;
}

/** Регион входит в разрешённые (список через запятую, '*' — все). */
export function regionAllowed(regions: string, region: string): boolean {
  const list = String(regions || 'RS').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (list.includes('*')) return true;
  return list.includes(String(region || '').toUpperCase());
}
