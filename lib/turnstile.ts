/** Cloudflare Turnstile: серверная проверка через Siteverify. */

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
}

export function turnstileEnforced(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY) || process.env.TURNSTILE_ENFORCE === '1';
}

export type TurnstileResult = { ok: boolean; error?: string };

/** Проверяет токен. Если защита включена, а ключа нет — это ошибка конфигурации,
 *  а не «пропускаем на всякий случай». */
export async function verifyTurnstile(token: string, ip?: string): Promise<TurnstileResult> {
  if (!turnstileEnforced()) return { ok: true };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, error: 'turnstile_not_configured' };
  if (!token) return { ok: false, error: 'turnstile_required' };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean };
    return json.success ? { ok: true } : { ok: false, error: 'turnstile_failed' };
  } catch {
    return { ok: false, error: 'turnstile_unreachable' };
  }
}
