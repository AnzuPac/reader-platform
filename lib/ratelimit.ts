import { query } from './db';

/**
 * Ограничитель частоты.
 *
 * Счётчики живут в БД (переживают рестарт и общие для нескольких инстансов).
 * Память процесса — только аварийный fallback, если БД недоступна: в этом
 * случае лучше ограничить строже и локально, чем открыть шлюз полностью.
 * Отдельно про IP: заголовок X-Forwarded-For подделывается клиентом, поэтому
 * по умолчанию доверяем только X-Real-IP (его выставляет Caddy), а XFF —
 * лишь при явном TRUST_PROXY=1.
 */

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = memory.get(key);
  if (!b || b.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const resetAt = new Date(now + windowMs).toISOString();
  const nowIso = new Date(now).toISOString();
  try {
    // Один атомарный upsert с RETURNING: при параллельных запросах никто
    // не проходит по устаревшему SELECT (находка review-2, P1).
    const rows = await query<{ hits: number | string; reset_at: string }>(
      `INSERT INTO rate_limit_buckets (scope_key, hits, reset_at) VALUES ($1, 1, $2)
       ON CONFLICT (scope_key) DO UPDATE SET
         hits = CASE WHEN rate_limit_buckets.reset_at < $3 THEN 1 ELSE rate_limit_buckets.hits + 1 END,
         reset_at = CASE WHEN rate_limit_buckets.reset_at < $3 THEN $2 ELSE rate_limit_buckets.reset_at END
       RETURNING hits, reset_at`,
      [key, resetAt, nowIso],
    );
    const b = rows[0];
    if (!b) return memoryLimit(key, limit, windowMs);
    const hits = Number(b.hits);
    if (hits <= limit) {
      if (Math.random() < 0.02) {
        await query('DELETE FROM rate_limit_buckets WHERE reset_at < $1', [new Date(now - 86_400_000).toISOString()]).catch(() => {});
      }
      return { ok: true, retryAfter: 0 };
    }
    return { ok: false, retryAfter: Math.max(1, Math.ceil((new Date(b.reset_at).getTime() - now) / 1000)) };
  } catch {
    return memoryLimit(key, limit, windowMs);
  }
}

/** Ключ клиента: X-Real-IP по умолчанию, XFF — только при TRUST_PROXY=1. */
export function clientKey(req: Request, scope: string): string {
  const realIp = (req.headers.get('x-real-ip') || '').trim();
  const trustProxy = process.env.TRUST_PROXY === '1';
  const forwarded = trustProxy
    ? (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean).pop() || ''
    : '';
  const ip = realIp || forwarded || 'local';
  return `${scope}:${ip}`;
}
