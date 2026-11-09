import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { requireAuthor } from '@/lib/author';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let html = '';

  try {
    if (name.endsWith('.docx')) {
      const res = await mammoth.convertToHtml({ buffer: buf });
      html = res.value;
    } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
      html = await marked.parse(buf.toString('utf8'));
    } else if (name.endsWith('.txt')) {
      html = buf.toString('utf8').split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    } else {
      return NextResponse.json({ error: 'unsupported' }, { status: 415 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'parse_failed', detail: String(e).slice(0, 120) }, { status: 422 });
  }

  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br','h1','h2','h3','strong','em','u','li','ul','ol','blockquote','hr','img'], ALLOWED_ATTR: ['src','alt'] });
  const words = clean.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return NextResponse.json({ ok: true, html: clean, words });
}
