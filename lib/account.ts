import { query, one } from './db';
import { hashPassword } from './auth';

/** Экспорт только собственных данных пользователя (ZZPL/GDPR). */
export async function exportAccount(uid: number) {
  const user = await one<Record<string, unknown>>(
    'SELECT id, email, display_name, role, locale, created_at FROM users WHERE id = $1', [uid]
  );
  const purchases = await query('SELECT id, work_id, chapter_id, amount_cents, coins, status, created_at FROM purchases WHERE user_id = $1 ORDER BY id', [uid]);
  const donations = await query('SELECT id, work_id, chapter_id, amount_cents, message, status, created_at FROM donations WHERE user_id = $1 ORDER BY id', [uid]);
  const library = await query('SELECT work_id, created_at FROM library_items WHERE user_id = $1 ORDER BY created_at', [uid]);
  const comments = await query('SELECT id, chapter_id, body, created_at FROM comments WHERE user_id = $1 ORDER BY id', [uid]);
  const wallet = await one('SELECT balance_coins FROM wallets WHERE user_id = $1', [uid]);
  const coinTx = await query('SELECT delta, kind, ref_id, created_at FROM coin_transactions WHERE user_id = $1 ORDER BY id', [uid]);
  const subscriptions = await query('SELECT plan_code, status, current_period_start AS started_at, current_period_end AS ends_at FROM subscriptions WHERE user_id = $1 ORDER BY id', [uid]);
  return { exported_at: new Date().toISOString(), user, purchases, donations, library, comments, wallet, coin_transactions: coinTx, subscriptions };
}

/**
 * Мягкое удаление: вход невозможен, профиль обезличен, комментарии скрыты.
 * Финансовые записи сохраняются (требование закона), но привязаны к обезличенному id.
 */
export async function deleteAccount(uid: number): Promise<{ ok: true }> {
  await query(
    `UPDATE users SET email = 'deleted+' || id || '@invalid', display_name = 'Obrisan nalog',
            password_hash = NULL, deleted_at = now() WHERE id = $1`, [uid]
  );
  await query('UPDATE comments SET hidden = TRUE WHERE user_id = $1', [uid]).catch(() => {});
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [uid]).catch(() => {});
  await query('DELETE FROM family_members WHERE member_user_id = $1 OR owner_user_id = $1', [uid]).catch(() => {});
  return { ok: true };
}
