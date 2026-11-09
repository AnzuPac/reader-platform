import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { initSchema, query, one } from '@/lib/db';
import { requireAuthor } from '@/lib/author';

export const runtime = 'nodejs';

/** Загрузка страниц комикса: multipart, несколько картинок + workSlug + number. */
export async function POST(req: Request) {
  const s = await requireAuthor();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  const slug = String(form.get('workSlug') || '').trim();
  const number = Number(form.get('number'));
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!slug || !Number.isFinite(number) || files.length === 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  await initSchema();
  const work = await one<{ id: number; author_id: number; type: string }>('SELECT id, author_id, type FROM works WHERE slug = $1', [slug]);
  if (!work || work.author_id !== s.uid) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const chapter = await query<{ id: number }>(
    `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
     VALUES ($1,$2,$3,'',0,$4,'draft')
     ON CONFLICT (work_id, number) DO UPDATE SET title = EXCLUDED.title, access = EXCLUDED.access
     RETURNING id`,
    [work.id, number, String(form.get('title') || `Glava ${number}`), String(form.get('access') || 'free')]
  );
  const chapterId = chapter[0].id;

  const dir = path.join(process.cwd(), 'public', 'uploads', 'comics', slug, String(number));
  await mkdir(dir, { recursive: true });

  let startPage = 1;
  const existing = await one<{ mx: number | null }>('SELECT MAX(page_no) AS mx FROM chapter_pages WHERE chapter_id = $1', [chapterId]);
  if (existing?.mx) startPage = existing.mx + 1;

  let i = startPage;
  const saved: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 12 * 1024 * 1024) continue;
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const name = `${String(i).padStart(3, '0')}.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const rel = `/uploads/comics/${slug}/${number}/${name}`;
    await query('INSERT INTO chapter_pages (chapter_id, page_no, file_path) VALUES ($1,$2,$3)', [chapterId, i, rel]);
    saved.push(rel);
    i += 1;
  }

  const cnt = await one<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM chapter_pages WHERE chapter_id = $1', [chapterId]);
  await query('UPDATE chapters SET word_count = $2 WHERE id = $1', [chapterId, cnt?.n ?? 0]);
  return NextResponse.json({ ok: true, chapterId, pages: saved.length, total: cnt?.n ?? 0 });
}
