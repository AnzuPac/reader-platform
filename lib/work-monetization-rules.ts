export type WorkMonetizationRow = {
  kind?: string | null;
  is_classic?: boolean | number | null;
  type?: string | null;
  publisher_id?: number | null;
  rights_confirmed?: boolean | number | null;
};

/** Platform policy: fanfiction and public-domain works are donation-only. */
export function isCommerciallyEligible(work: WorkMonetizationRow): boolean {
  if (String(work.kind || 'original') === 'fanfic') return false;
  if (Boolean(work.is_classic)) return false;
  if (work.rights_confirmed === false || work.rights_confirmed === 0) return false;
  return true;
}
