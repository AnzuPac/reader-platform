import { query, one, initSchema } from './db';

export async function isSubscriber(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  await initSchema();
  const row = await one(
    `SELECT 1 AS ok FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND current_period_end > now() LIMIT 1`,
    [userId]
  );
  return !!row;
}

export async function getAdSlot(code: string): Promise<{ html: string; title: string } | null> {
  await initSchema();
  const row = await one<{ html: string; title: string }>(
    'SELECT html, title FROM ad_slots WHERE code = $1 AND active = 1', [code]
  );
  return row && row.html ? row : null;
}
