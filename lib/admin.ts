import { query, one } from './db';

export function adminTokenOk(req: Request): boolean {
  const need = process.env.ADMIN_TOKEN || 'dev-admin-token';
  const got = req.headers.get('x-admin-token') || '';
  return got === need;
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
