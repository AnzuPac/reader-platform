import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** GET /api/admin/publisher — список издательств. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const rows = await query(
    `SELECT p.id, p.name, p.slug, p.contact_email, p.commission_pct,
            (SELECT COUNT(*) FROM publisher_members m WHERE m.publisher_id = p.id) AS members
       FROM publishers p ORDER BY p.name`
  );
  return NextResponse.json({ publishers: rows });
}

/**
 * POST /api/admin/publisher — создать издательство и (опционально) сразу
 * привязать участника по email. {name, slug?, contactEmail?, commissionPct?, memberEmail?, role?}
 */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const slug = String(b?.slug || name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || `publisher-${Date.now()}`;

  const pctRaw = b?.commissionPct ?? b?.commission_pct ?? 30;
  const commissionPct = Math.max(0, Math.min(100, Math.trunc(Number(pctRaw))));

  await initSchema();
  const existing = await one<{ id: number }>('SELECT id FROM publishers WHERE slug = $1', [slug]);
  if (existing) return NextResponse.json({ error: 'slug_taken', publisherId: existing.id }, { status: 409 });

  const rows = await query<{ id: number }>(
    `INSERT INTO publishers (name, slug, contact_email, commission_pct)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [name, slug, String(b?.contactEmail || ''), commissionPct]
  );
  const publisherId = rows[0].id;

  let memberUserId: number | null = null;
  const memberEmail = String(b?.memberEmail || '').trim().toLowerCase();
  if (memberEmail) {
    const user = await one<{ id: number }>('SELECT id FROM users WHERE lower(email) = $1', [memberEmail]);
    if (user) {
      memberUserId = user.id;
      const role = ['owner', 'manager', 'member'].includes(String(b?.role)) ? String(b?.role) : 'owner';
      await query(
        `INSERT INTO publisher_members (publisher_id, user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [publisherId, user.id, role]
      );
    }
  }

  return NextResponse.json({ ok: true, publisherId, slug, memberUserId });
}
