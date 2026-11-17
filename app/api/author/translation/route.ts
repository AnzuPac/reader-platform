import { NextResponse } from 'next/server';
import { requireAuthor } from '@/lib/author';
import { listAuthorTranslations, requestTranslation } from '@/lib/translation-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — мои заявки на перевод со статусами. */
export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const requests = await listAuthorTranslations(s.uid);
  return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST — { chapterId, targetLang } — заявка на перевод главы. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const chapterId = Number(b?.chapterId);
  const targetLang = String(b?.targetLang || '');
  if (!chapterId || !['sr', 'en', 'ru'].includes(targetLang)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  const r = await requestTranslation({ chapterId, targetLang: targetLang as 'sr' | 'en' | 'ru', userId: s.uid });
  if (!r.ok) {
    const code = r.error === 'not_found' ? 404 : r.error === 'duplicate' ? 409 : 409;
    return NextResponse.json({ error: r.error }, { status: code });
  }
  return NextResponse.json({ ok: true, id: r.id });
}
