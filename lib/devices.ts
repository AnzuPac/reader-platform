import { createHash } from 'node:crypto';
import { one, query } from './db';

/**
 * Мягкий лимит устройств для платного контента.
 *
 * Устройство = hash(User-Agent + IP). Один и тот же браузер с того же адреса
 * считается одним устройством; смена сети — новым. Сверх лимита платный текст
 * не отдаётся (403), бесплатный — не затрагивается.
 */

export const DEVICE_LIMIT = 3;
export const DEVICE_STALE_DAYS = 30;

export function deviceFingerprint(req: Request): { deviceHash: string; userAgent: string; ipHash: string } {
  const ua = (req.headers.get('user-agent') || '').slice(0, 300);
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = (fwd.split(',')[0] || '').trim() || 'local';
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const deviceHash = createHash('sha256').update(`${ua}|${ipHash}`).digest('hex').slice(0, 32);
  return { deviceHash, userAgent: ua, ipHash };
}

export type DeviceDecision = 'known' | 'allow_new' | 'blocked';

/** Чистое правило: можно ли пустить это устройство. */
export function decideDevice(isKnown: boolean, activeCount: number, limit = DEVICE_LIMIT): DeviceDecision {
  if (isKnown) return 'known';
  if (activeCount < limit) return 'allow_new';
  return 'blocked';
}

export type DeviceResult =
  | { allowed: true; deviceHash: string; known: boolean }
  | { allowed: false; reason: 'device_limit'; count: number; limit: number };

export async function registerContentDevice(userId: number, req: Request): Promise<DeviceResult> {
  const fp = deviceFingerprint(req);

  const known = await one('SELECT id FROM content_devices WHERE user_id = $1 AND device_hash = $2', [
    userId,
    fp.deviceHash,
  ]);
  if (known) {
    await query('UPDATE content_devices SET last_seen_at = now() WHERE user_id = $1 AND device_hash = $2', [
      userId,
      fp.deviceHash,
    ]);
    return { allowed: true, deviceHash: fp.deviceHash, known: true };
  }

  const cutoff = new Date(Date.now() - DEVICE_STALE_DAYS * 86400_000).toISOString();
  await query('DELETE FROM content_devices WHERE user_id = $1 AND last_seen_at < $2', [userId, cutoff]);

  const row = await one<{ n: number }>('SELECT COUNT(*) AS n FROM content_devices WHERE user_id = $1', [userId]);
  const count = Number(row?.n || 0);
  if (decideDevice(false, count) === 'blocked') {
    return { allowed: false, reason: 'device_limit', count, limit: DEVICE_LIMIT };
  }

  await query(
    `INSERT INTO content_devices (user_id, device_hash, user_agent, ip_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, device_hash) DO UPDATE SET last_seen_at = now()`,
    [userId, fp.deviceHash, fp.userAgent, fp.ipHash]
  );
  return { allowed: true, deviceHash: fp.deviceHash, known: false };
}
