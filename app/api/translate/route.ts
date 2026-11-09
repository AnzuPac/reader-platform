import { NextResponse } from 'next/server';
import { translateChapter, type Lang } from '@/lib/translate';
import { rateLimit, clientKey } from '@/lib/ratelimit';

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
    const res = await translateChapter(chapterId, lang);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: 'translate_failed', detail: String(e).slice(0, 160) }, { status: 500 });
  }
}
