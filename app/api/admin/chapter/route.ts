import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { adminTokenOk } from '@/lib/admin';

export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const slug = String(b?.workSlug || '').trim();
  const content = String(b?.content || '');
  const number = Number(b?.number);
  if (!slug || !content || !Number.isFinite(number)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await initSchema();
  const work = await one<{ id: number }>('SELECT id FROM works WHERE slug = $1', [slug]);
  if (!work) return NextResponse.json({ error: 'work_not_found' }, { status: 404 });
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const rows = await query<{ id: number; number: number }>(
    `INSERT INTO chapters (work_id, number, title, content, word_count, access, status, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,'published', now())
     ON CONFLICT (work_id, number) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
       word_count = EXCLUDED.word_count, access = EXCLUDED.access, status = 'published', published_at = now()
     RETURNING id, number`,
    [work.id, number, String(b?.title || `Glava ${number}`), content, words, (b?.access === 'subscribers' || b?.access === 'paid') ? b.access : 'free']
  );
  await query('UPDATE works SET words_total = (SELECT COALESCE(SUM(word_count),0) FROM chapters WHERE work_id=$1 AND status=$2) WHERE id=$1', [work.id, 'published']);
  return NextResponse.json({ ok: true, chapter: rows[0] });
}
