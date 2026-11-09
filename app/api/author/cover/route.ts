import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

export const runtime = 'nodejs';

/** Обложка произведения глазами автора: только для своих работ. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const slug = String(form?.get('workSlug') || '').trim();
  const file = form?.get('file');
  if (!slug || !(file instanceof File)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'not_image' }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const rel = `/uploads/covers/${slug}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'covers');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${slug}.${ext}`), Buffer.from(await file.arrayBuffer()));
  await query('UPDATE works SET cover_path = $2, updated_at = now() WHERE id = $1', [work.id, rel]);

  return NextResponse.json({ ok: true, cover: rel });
}
