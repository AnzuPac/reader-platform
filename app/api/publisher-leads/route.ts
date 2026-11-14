import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST /api/publisher-leads — заявка со страницы для издателей. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, 'publisher-lead'), 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim().slice(0, 120);
  const company = String(b?.company || '').trim().slice(0, 160);
  const email = String(b?.email || '').trim().toLowerCase().slice(0, 200);
  const phone = String(b?.phone || '').trim().slice(0, 40);
  const message = String(b?.message || '').trim().slice(0, 2000);

  if (!name || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  await initSchema();
  const rows = await query<{ id: number }>(
    `INSERT INTO publisher_leads (name, company, email, phone, message)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, company, email, phone, message]
  );

  return NextResponse.json({ ok: true, leadId: rows[0].id });
}
