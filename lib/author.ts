import { readSession, type Session } from './auth';

export const AUTHOR_ROLES = ['author', 'admin', 'moderator'];

export async function requireAuthor(): Promise<Session | null> {
  const s = await readSession();
  if (!s) return null;
  if (!AUTHOR_ROLES.includes(s.role)) return null;
  return s;
}
