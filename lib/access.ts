export type ChapterAccess = 'free' | 'subscribers' | 'paid';

export type AccessContext = {
  access: ChapterAccess | string;
  loggedIn: boolean;
  hasEntitlement: boolean;
  hasActiveSubscription: boolean;
};

/** Единственное место, где решается, можно ли отдать текст главы. */
export function canReadChapter(ctx: AccessContext): boolean {
  if (ctx.access === 'free') return true;
  if (!ctx.loggedIn) return false;
  if (ctx.hasEntitlement) return true;
  return ctx.access === 'subscribers' && ctx.hasActiveSubscription;
}

/**
 * Правило доступа Фазы 1: книга куплена целиком ИЛИ куплена конкретная глава.
 * Чистая функция — БД-обвязка в lib/purchases.ts (chapterGate).
 */
export type GateInput = {
  access: string;
  loggedIn: boolean;
  isAuthor: boolean;
  isAdmin: boolean;
  hasSubscription: boolean;
  hasWorkPurchase: boolean;
  hasChapterPurchase: boolean;
  hasEntitlement: boolean;
};

export type GateResult = {
  allowed: boolean;
  reason: 'free' | 'author' | 'admin' | 'purchased' | 'subscription'
        | 'login_required' | 'subscription_required' | 'payment_required';
};

export function decideChapterAccess(g: GateInput): GateResult {
  if (g.access === 'free') return { allowed: true, reason: 'free' };
  if (!g.loggedIn) return { allowed: false, reason: 'login_required' };
  if (g.isAdmin) return { allowed: true, reason: 'admin' };
  if (g.isAuthor) return { allowed: true, reason: 'author' };
  if (g.hasWorkPurchase || g.hasChapterPurchase || g.hasEntitlement) {
    return { allowed: true, reason: 'purchased' };
  }
  if (g.access === 'subscribers' && g.hasSubscription) {
    return { allowed: true, reason: 'subscription' };
  }
  if (g.access === 'paid') return { allowed: false, reason: 'payment_required' };
  return { allowed: false, reason: 'subscription_required' };
}
