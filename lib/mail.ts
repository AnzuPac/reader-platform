/** Отправка писем через Resend HTTP API. Без ключа — тихий пропуск (dev/демо). */
export type MailResult = { ok: boolean; skipped?: boolean; error?: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, skipped: true };
  const from = process.env.MAIL_FROM || 'Čitaonica <no-reply@example.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) return { ok: false, error: `resend_${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || 'fetch_failed').slice(0, 80) };
  }
}
