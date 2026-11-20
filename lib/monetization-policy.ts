import { one } from './db';
import { isCommerciallyEligible, type WorkMonetizationRow } from './work-monetization-rules';
export { isCommerciallyEligible } from './work-monetization-rules';
export type { WorkMonetizationRow } from './work-monetization-rules';

export async function getWorkMonetization(workId: number): Promise<WorkMonetizationRow | null> {
  return one<WorkMonetizationRow>(
    'SELECT kind, is_classic, type, publisher_id FROM works WHERE id = $1', [workId]
  );
}
export async function assertWorkCommerciallyEligible(workId: number): Promise<boolean> {
  const work = await getWorkMonetization(workId);
  return !!work && isCommerciallyEligible(work);
}
