import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

export const runtime = 'nodejs';

const OK_EXT = ['ttf', 'otf', 'woff', 'woff2'];
const MIME: Record<string, string> = {
  'font/ttf': 'ttf', 'font/otf': 'otf', 'font/woff': 'woff', 'font/woff2': 'woff2',
  'application/font-woff': 'woff', 'application/x-font-ttf': 'ttf',
};

export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const slug = String(form?.get('workSlug') || '').trim();
  const name = String(form?.get('family') || '').trim() || 'Custom';
  const file = form?.get('file');
  if (!slug || !(file instanceof File)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!OK_EXT.includes(ext)) return NextResponse.json({ error: 'bad_format' }, { status: 415 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  await initSchema();
  const work = await one<{ id: number; author_id: number }>('SELECT id, author_id FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const safeFamily = name.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40) || 'Custom';
  const fileName = `${slug}-${safeFamily.replace(/\s+/g, '-')}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'fonts');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

  const rel = `/uploads/fonts/${fileName}`;
  await query('UPDATE works SET font_family = $2, font_path = $3 WHERE id = $1', [work.id, safeFamily, rel]);
  return NextResponse.json({ ok: true, family: safeFamily, font: rel });
}
