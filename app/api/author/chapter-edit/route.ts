import { NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';
import { requireAuthor } from '@/lib/author';
import { listAuthorEdits, submitChapterEdit } from '@/lib/chapter-edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** GET — мои заявки на правку с их статусами. */
export async function GET() {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const requests = await listAuthorEdits(s.uid);
  return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST — отправить правку опубликованной главы на модерацию. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const workSlug = String(b?.workSlug || '').trim();
  const number = Number(b?.number);
  if (!workSlug || !Number.isFinite(number)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const clean = DOMPurify.sanitize(String(b?.content || ''), {
    ALLOWED_TAGS: ['p','br','h1','h2','h3','strong','em','u','s','ul','ol','li','blockquote','hr','img','a','span'],
    ALLOWED_ATTR: ['src','href','alt','style','class'],
  });
  const words = plainText(clean).split(/\s+/).filter(Boolean).length;
  if (!words) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const r = await submitChapterEdit({
    workSlug,
    number,
    authorId: s.uid,
    title: String(b?.title || `Glava ${number}`),
    content: clean,
    wordCount: words,
  });

  if (!r.ok) {
    const status = r.error === 'not_found' ? 404 : 409;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ ok: true, requestId: r.id, words });
}
