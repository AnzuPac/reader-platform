import { query, query as q } from './db';
import { sendEmail, mailConfigured } from './mail';

export type RenewalSummary = { due: number; sent: number; skipped: number; failed: number; configured: boolean };

/**
 * Напоминания о продлении за N дней (ТЗ 4.9): письмо уходит один раз,
 * отметка reminder_sent_at ставится только при успешной отправке.
 */
export async function runRenewalReminders(days = 3): Promise<RenewalSummary> {
  const rows = await query<{ id: number; user_id: number; email: string; plan_code: string; current_period_end: string }>(
    `SELECT s.id, s.user_id, u.email, s.plan_code, s.current_period_end
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active'
        AND s.reminder_sent_at IS NULL
        AND date(s.current_period_end) <= date(now(), '+' || $1 || ' days')
        AND date(s.current_period_end) >= date(now())`,
    [days]
  );

  let sent = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const res = await sendEmail(
      r.email,
      'Pretplata se uskoro obnavlja',
      `<p>Vaša pretplata (${r.plan_code}) se obnavlja ${String(r.current_period_end).slice(0, 10)}.</p>
       <p>Otkažite u dva klika u profilu ako ne želite obnavljanje.</p>`
    );
    if (res.ok && res.skipped) { skipped += 1; continue; }
    if (res.ok) {
      await q('UPDATE subscriptions SET reminder_sent_at = now() WHERE id = $1', [r.id]);
      sent += 1;
    } else {
      failed += 1;
    }
  }
  return { due: rows.length, sent, skipped, failed, configured: mailConfigured() };
}
