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
