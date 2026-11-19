import { query, one } from './db';
import { ADMIN_COOKIE, getAdminToken, safeEqual } from './secrets';

/** Достаёт cookie по имени из заголовка запроса (без next/headers — функция синхронная). */
function cookieValue(req: Request, name: string): string {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return '';
}

/**
 * Проверка админ-доступа. Fail-closed: если ADMIN_TOKEN не задан —
 * доступ закрыт полностью (никаких дефолтных токенов).
 * Токен принимается из заголовка X-Admin-Token или из HttpOnly-cookie,
 * которую ставит /api/admin/session — так он не живёт в localStorage.
 */
export function adminTokenOk(req: Request): boolean {
  const need = getAdminToken();
  if (!need) return false;
  const header = (req.headers.get('x-admin-token') || '').trim();
  if (header && safeEqual(header, need)) return true;
  const fromCookie = cookieValue(req, ADMIN_COOKIE).trim();
  if (fromCookie && safeEqual(fromCookie, need)) return true;
  return false;
}

export async function ensureAuthor(): Promise<number> {
  const existing = await one<{ id: number }>("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  if (existing) return existing.id;
  const rows = await query<{ id: number }>(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ('system@local', NULL, 'Sistem', 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin'
     RETURNING id`
  );
  return rows[0].id;
}
