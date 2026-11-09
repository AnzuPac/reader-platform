import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

/** action: publish | hide | review | draft */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug || '').trim();
  const action = String(b?.action || '');
  const map: Record<string, string> = { publish: 'published', hide: 'hidden', review: 'review', draft: 'draft' };
  if (!slug || !map[action]) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await initSchema();
  await query('UPDATE works SET status = $2, published_at = CASE WHEN $2 = $3 THEN COALESCE(published_at, now()) ELSE published_at END, updated_at = now() WHERE slug = $1',
    [slug, map[action], 'published']);
  return NextResponse.json({ ok: true, status: map[action] });
}
