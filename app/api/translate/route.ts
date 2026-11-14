import { NextResponse } from 'next/server';
import { translateChapter, type Lang } from '@/lib/translate';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { initSchema, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { chapterGate } from '@/lib/purchases';
import { encodeWatermark } from '@/lib/watermark';

export const maxDuration = 120;

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, 'translate'), 20, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  const b = await req.json().catch(() => null);
  const chapterId = Number(b?.chapterId);
  const lang = String(b?.lang || '') as Lang;
  if (!chapterId || !['sr','en','ru'].includes(lang)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  try {
    await initSchema();
    const ch = await one<{ work_id: number; access: string }>(
      'SELECT work_id, access FROM chapters WHERE id = $1 AND status = $2',
      [chapterId, 'published']
    );
    if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const session = await readSession();
    const gate = await chapterGate({ id: chapterId, work_id: ch.work_id, access: ch.access }, session);
    if (!gate.allowed) {
      return NextResponse.json({ error: 'locked', reason: gate.reason }, { status: 403 });
    }
    const res = await translateChapter(chapterId, lang);
    if (ch.access !== 'free' && session) res.content = encodeWatermark(res.content, session.uid);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: 'translate_failed', detail: String(e).slice(0, 160) }, { status: 500 });
  }
}
