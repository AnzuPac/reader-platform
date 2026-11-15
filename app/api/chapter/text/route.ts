import { NextResponse } from 'next/server';
import { initSchema, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { chapterGate } from '@/lib/purchases';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { encodeWatermark } from '@/lib/watermark';
import { registerContentDevice } from '@/lib/devices';
import { translitSr } from '@/lib/sr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

/**
 * GET /api/chapter/text?chapter=ID — выдача текста главы.
 *
 * Для платного/премиум-контента: проверка доступа, мягкий лимит устройств,
 * водяной знак с user_id и жёсткий rate limit (60 запросов текста в минуту).
 */
export async function GET(req: Request) {
  const chapterId = Number(new URL(req.url).searchParams.get('chapter'));
  if (!Number.isFinite(chapterId) || chapterId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });
  }

  await initSchema();
  const ch = await one<{ id: number; work_id: number; content: string; access: string; title: string; translit_allowed: number }>(
    `SELECT c.id, c.work_id, c.content, c.access, c.title, w.translit_allowed
       FROM chapters c JOIN works w ON w.id = c.work_id
      WHERE c.id = $1 AND c.status = $2`,
    [chapterId, 'published']
  );
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

  const session = await readSession();
  const gate = await chapterGate({ id: ch.id, work_id: ch.work_id, access: ch.access }, session);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'locked', reason: gate.reason }, { status: 403, headers: NO_STORE });
  }

  const rl = rateLimit(`chapter-text:${session?.uid ?? clientKey(req, 'anon')}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too_many_requests', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const script = new URL(req.url).searchParams.get('script');
  let content = script === 'lat' && ch.translit_allowed ? translitSr(ch.content, 'lat') : ch.content;
  if (ch.access !== 'free') {
    if (!session) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401, headers: NO_STORE });
    }
    const device = await registerContentDevice(session.uid, req);
    if (!device.allowed) {
      return NextResponse.json(
        {
          error: 'device_limit',
          message:
            'Dostigli ste limit od 3 uređaja za plaćeni sadržaj. Odjavite se na starom uređaju ili kontaktirajte podršku.',
          count: device.count,
          limit: device.limit,
        },
        { status: 403, headers: NO_STORE }
      );
    }
    content = encodeWatermark(content, session.uid);
  }

  return NextResponse.json(
    { content, title: ch.title, protected: ch.access !== 'free' },
    { headers: NO_STORE }
  );
}
