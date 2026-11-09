import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAuthor } from '@/lib/author';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'not_image' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg';
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'content');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, url: `/uploads/content/${name}` });
}
