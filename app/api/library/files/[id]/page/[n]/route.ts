import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveStoredFile } from '@/lib/user-files';
import { listComicPages } from '@/lib/epub';
import { readEntry } from '@/lib/zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif',
};

export async function GET(_req: Request, context: { params: Promise<{ id: string; n: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, n } = await context.params;

  const rows = await query<{ path: string; format: string }>(
    `SELECT f.path, b.format FROM user_book_files f JOIN user_books b ON b.id = f.user_book_id
      WHERE f.id = $1 AND b.user_id = $2 AND b.format = 'cbz'`,
    [Number(id) || 0, session.uid],
  );
  const file = rows[0];
  if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let data: Buffer;
  try {
    data = await fs.readFile(resolveStoredFile(file.path));
  } catch {
    return NextResponse.json({ error: 'file_missing' }, { status: 410 });
  }

  const pages = listComicPages(data);
  const index = Number(n) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
    return NextResponse.json({ error: 'page_out_of_range', pages: pages.length }, { status: 404 });
  }

  const entry = pages[index];
  const ext = (entry.name.split('.').pop() || '').toLowerCase();
  const bytes = readEntry(data, entry);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': String(bytes.length),
      'cache-control': 'private, max-age=60',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "frame-ancestors 'self'",
    },
  });
}
