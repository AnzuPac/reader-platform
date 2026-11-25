import { NextResponse } from 'next/server';
import { requireAuthor } from '@/lib/author';
import { buildPreview } from '@/lib/import-parse';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const rl = await rateLimit(clientKey(req, `import-preview:${s.uid}`), 30, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const preview = await buildPreview(file.name, buf);
  if ('error' in preview) return NextResponse.json({ error: preview.error }, { status: 422 });
  return NextResponse.json({ ok: true, ...preview });
}
