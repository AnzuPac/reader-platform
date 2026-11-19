import { readSession, type Session } from './auth';
import { one } from './db';

export const AUTHOR_ROLES = ['author', 'admin', 'moderator'];

/**
 * Роль и статус берём из БД, а не из JWT: иначе понижение роли или блокировка
 * не действуют до истечения access-токена (аудит, п.15).
 */
export async function requireAuthor(): Promise<Session | null> {
  const s = await readSession();
  if (!s) return null;
  const row = await one<{ role: string; status: string }>(
    'SELECT role, status FROM users WHERE id = $1 AND deleted_at IS NULL',
    [s.uid],
  ).catch(() => null);
  if (!row) return null;
  if ((row.status || 'active') !== 'active') return null;
  if (!AUTHOR_ROLES.includes(row.role)) return null;
  return { ...s, role: row.role };
}
