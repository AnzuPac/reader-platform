import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';
import { publishDue, scheduleChapter } from '@/lib/publish';

/** Публикация главы или всего произведения. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const workSlug = String(b?.workSlug || '').trim();
  const number = b?.number ? Number(b.number) : null;
  const publish = b?.publish !== false;
  const publishAtRaw = typeof b?.publishAt === 'string' ? b.publishAt : '';
  if (!workSlug) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [workSlug]);
  if (!work || Number(work.author_id) !== Number(s.uid)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (number && publishAtRaw) {
    const when = Date.parse(publishAtRaw);
    if (!Number.isFinite(when)) return NextResponse.json({ error: 'bad_date' }, { status: 400 });
    await scheduleChapter(work.id, Number(number), new Date(when).toISOString());
  } else if (number) {
    await query(
      `UPDATE chapters SET status = $3, published_at = CASE WHEN $3 = 'published' THEN now() ELSE published_at END
        WHERE work_id = $1 AND number = $2`,
      [work.id, number, publish ? 'published' : 'draft']
    );
  }
  await publishDue(work.id).catch(() => 0);
  if (publish) {
    const cnt = await one<{ n: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM chapters WHERE work_id = $1 AND status = 'published'", [work.id]);
    if (cnt && cnt.n > 0) {
      const cur = await one<{ status: string }>('SELECT status FROM works WHERE id = $1', [work.id]);
      if (cur?.status === 'published') {
        await query("UPDATE works SET published_at = COALESCE(published_at, now()) WHERE id = $1", [work.id]);
      } else {
        await query("UPDATE works SET status = 'review', updated_at = now() WHERE id = $1", [work.id]);
      }
    }
  }
  const ch = await query('SELECT number, status FROM chapters WHERE work_id = $1 ORDER BY number', [work.id]);
  return NextResponse.json({ ok: true, chapters: ch });
}
