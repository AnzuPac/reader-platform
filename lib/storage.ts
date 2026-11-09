import { initSchema, one } from './db';

const FREE = 1024 ** 3;          // 1 ГБ
const READER = 5 * 1024 ** 3;
const READER_PLUS = 20 * 1024 ** 3;

export type Quota = { used: number; limit: number; plan: string };

export async function getQuota(userId: number): Promise<Quota> {
  await initSchema();
  const used = await one<{ storage_used: number }>('SELECT storage_used FROM users WHERE id = $1', [userId]);
  const sub = await one<{ plan_code: string }>(
    `SELECT plan_code FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND current_period_end > now()
      ORDER BY CASE plan_code WHEN 'reader_plus' THEN 3 WHEN 'reader' THEN 2 ELSE 1 END DESC LIMIT 1`,
    [userId]
  );
  const plan = sub?.plan_code || 'free';
  const limit = plan === 'reader_plus' ? READER_PLUS : plan === 'reader' ? READER : FREE;
  return { used: Number(used?.storage_used ?? 0), limit, plan };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
