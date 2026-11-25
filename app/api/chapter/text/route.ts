import { NextResponse } from 'next/server';
import { initSchema, one, query } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { chapterGate } from '@/lib/purchases';
import { publishDueIfAny } from '@/lib/publish';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { verifyChapterToken } from '@/lib/content-token';
import { encodeWatermark } from '@/lib/watermark';
import { registerContentDevice } from '@/lib/devices';
import { TRANSLIT_ALLOWED_SQL, flag } from '@/lib/search';
import { toScript, type Script } from '@/lib/translit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

/**
 * GET /api/chapter/text?chapter=ID — выдача текста главы.
 *
 * Для платного/премиум-контента: проверка доступа, мягкий лимит устройств,
 * водяной знак с user_id и жёсткий rate limit (60 запросов текста в минуту).
 *
 * ?script=lat|cir — транслитерация сербского текста (ТЗ 4.6). Разрешена только
 * там, где правообладатель не против (works.translit_allowed); водяной знак
 * накладывается уже после транслитерации.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chapterId = Number(url.searchParams.get('chapter'));
  const scriptParam = url.searchParams.get('script');
  const script: Script | null = scriptParam === 'lat' || scriptParam === 'cir' ? scriptParam : null;
  if (!Number.isFinite(chapterId) || chapterId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });
  }

  await initSchema();
  await publishDueIfAny().catch(() => 0);
  const ch = await one<{ id: number; work_id: number; content: string; access: string; title: string }>(
    'SELECT id, work_id, content, access, title FROM chapters WHERE id = $1 AND status = $2',
    [chapterId, 'published']
  );
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

  let session = await readSession();
  const tokenParam = new URL(req.url).searchParams.get('token');
  if (!session && tokenParam) {
    const verified = verifyChapterToken(tokenParam);
    // Токен привязан к главе: чужой токен на другую главу не подходит.
    if (verified && verified.chapterId === ch.id) {
      const user = await one<{ id: number; email: string; role: string; display_name: string }>(
        'SELECT id, email, role, display_name FROM users WHERE id = $1', [verified.uid],
      );
      if (user) session = { uid: user.id, email: user.email, role: user.role, name: user.display_name };
    }
  }
  const gate = await chapterGate({ id: ch.id, work_id: ch.work_id, access: ch.access }, session);
  if (!gate.allowed) {
    return NextResponse.json({ error: 'locked', reason: gate.reason }, { status: 403, headers: NO_STORE });
  }

  if (script) {
    const w = await one<{ allowed: unknown }>(
      `SELECT ${TRANSLIT_ALLOWED_SQL} AS allowed FROM works w WHERE w.id = $1`, [ch.work_id]
    );
    if (!w || !flag(w.allowed)) {
      return NextResponse.json(
        { error: 'translit_not_allowed', message: 'Prava na prenos pisma za ovo delo nisu dozvoljena.' },
        { status: 403, headers: NO_STORE }
      );
    }
  }

  const rl = await rateLimit(`chapter-text:${session?.uid ?? clientKey(req, 'anon')}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too_many_requests', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let content = script ? toScript(ch.content, script) : ch.content;
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
    await query('INSERT INTO watermark_records (user_id, chapter_id, work_id, kind) VALUES ($1,$2,$3,$4)',
      [session.uid, ch.id, ch.work_id, 'chapter']).catch(() => {});
  }

  return NextResponse.json(
    { content, title: ch.title, protected: ch.access !== 'free', script },
    { headers: NO_STORE }
  );
}
