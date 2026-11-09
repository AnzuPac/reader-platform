import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

/** Публикация главы или всего произведения. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const workSlug = String(b?.workSlug || '').trim();
  const number = b?.number ? Number(b.number) : null;
  const publish = b?.publish !== false;
  if (!workSlug) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [workSlug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (number) {
    await query(
      `UPDATE chapters SET status = $3, published_at = CASE WHEN $3 = 'published' THEN now() ELSE published_at END
        WHERE work_id = $1 AND number = $2`,
      [work.id, number, publish ? 'published' : 'draft']
    );
  }
  if (publish) {
    const cnt = await one<{ n: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM chapters WHERE work_id = $1 AND status = 'published'", [work.id]);
    if (cnt && cnt.n > 0) {
      await query("UPDATE works SET status = 'published', published_at = COALESCE(published_at, now()) WHERE id = $1", [work.id]);
    }
  }
  const ch = await query('SELECT number, status FROM chapters WHERE work_id = $1 ORDER BY number', [work.id]);
  return NextResponse.json({ ok: true, chapters: ch });
}
