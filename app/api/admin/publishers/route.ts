import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** GET /api/admin/publishers — издательства с комиссией, числом книг и владельцем. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await initSchema();
  const publishers = await query(
    `SELECT p.id, p.name, p.slug, p.contact_email, p.commission_pct,
            (SELECT COUNT(*) FROM works w WHERE w.publisher_id = p.id) AS works_count,
            (SELECT u.email FROM publisher_members m JOIN users u ON u.id = m.user_id
              WHERE m.publisher_id = p.id AND m.role = 'owner' ORDER BY m.user_id LIMIT 1) AS owner_email
       FROM publishers p ORDER BY p.name`
  );
  const works = await query(
    `SELECT w.id, w.slug, w.title, w.type, w.publisher_id,
            (SELECT amount_cents FROM book_prices bp WHERE bp.work_id = w.id AND bp.active = 1) AS price_cents
       FROM works w ORDER BY w.title`
  );
  return NextResponse.json({ publishers, works });
}

/**
 * POST /api/admin/publishers — создать издательство и привязать владельца по email.
 * {name, contactEmail?, commissionPct?, ownerEmail?}
 */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim().slice(0, 160);
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const slug = String(b?.slug || name)
    .toLowerCase().normalize('NFKD')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || `publisher-${Date.now()}`;

  const commissionPct = Math.max(0, Math.min(100, Math.trunc(Number(b?.commissionPct ?? 25))));
  await initSchema();

  const existing = await one<{ id: number }>('SELECT id FROM publishers WHERE slug = $1', [slug]);
  if (existing) return NextResponse.json({ error: 'slug_taken', publisherId: existing.id }, { status: 409 });

  const rows = await query<{ id: number }>(
    `INSERT INTO publishers (name, slug, contact_email, commission_pct)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [name, slug, String(b?.contactEmail || '').trim().toLowerCase(), commissionPct]
  );
  const publisherId = rows[0].id;

  let memberUserId: number | null = null;
  const ownerEmail = String(b?.ownerEmail || '').trim().toLowerCase();
  if (ownerEmail) {
    const user = await one<{ id: number }>('SELECT id FROM users WHERE lower(email) = $1', [ownerEmail]);
    if (user) {
      memberUserId = user.id;
      await query(
        `INSERT INTO publisher_members (publisher_id, user_id, role) VALUES ($1,$2,'owner')
         ON CONFLICT (publisher_id, user_id) DO UPDATE SET role = 'owner'`,
        [publisherId, user.id]
      );
    }
  }

  return NextResponse.json({ ok: true, publisherId, slug, memberUserId });
}
