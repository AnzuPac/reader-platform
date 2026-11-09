import { NextResponse } from 'next/server';
import { initSchema, one } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';
import { addWorkGenre } from '@/lib/repo';

export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const slug = String(b?.workSlug || '').trim();
  const genres: string[] = Array.isArray(b?.genres) ? b.genres.map(String) : [];
  if (!slug || !genres.length) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await initSchema();
  const work = await one<{ id: number }>('SELECT id FROM works WHERE slug = $1', [slug]);
  if (!work) return NextResponse.json({ error: 'work_not_found' }, { status: 404 });
  for (const g of genres) await addWorkGenre(work.id, g);
  return NextResponse.json({ ok: true, added: genres.length });
}
