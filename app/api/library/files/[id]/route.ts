import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveStoredFile, addUsage } from '@/lib/user-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownedFile(sessionUid: number, id: string) {
  const rows = await query<{
    id: number; path: string; mime: string | null; size_bytes: number | string;
    title: string; format: string; storage: string;
  }>(
    `SELECT f.id, f.path, f.mime, f.size_bytes, f.storage, b.title, b.format
       FROM user_book_files f JOIN user_books b ON b.id = f.user_book_id
      WHERE f.id = $1 AND b.user_id = $2`,
    [Number(id) || 0, sessionUid],
  );
  return rows[0] || null;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const file = await ownedFile(session.uid, id);
  if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (file.storage !== 'cloud') return NextResponse.json({ error: 'local_only' }, { status: 409 });

  let data: Buffer;
  try {
    data = await fs.readFile(resolveStoredFile(file.path));
  } catch {
    return NextResponse.json({ error: 'file_missing' }, { status: 410 });
  }

  const inline = new URL(req.url).searchParams.get('inline') === '1' && file.mime === 'application/pdf';
  const ascii = file.title.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'book';
  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': file.mime || 'application/octet-stream',
      'content-length': String(data.length),
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}.${file.format}"; filename*=UTF-8''${encodeURIComponent(file.title)}.${file.format}`,
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "frame-ancestors 'self'",
    },
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const file = await ownedFile(session.uid, id);
  if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (file.storage === 'cloud') {
    await fs.unlink(resolveStoredFile(file.path)).catch(() => {});
  }
  await query('DELETE FROM user_book_files WHERE id = $1', [file.id]);
  await query(
    'DELETE FROM user_books WHERE id NOT IN (SELECT user_book_id FROM user_book_files) AND user_id = $1',
    [session.uid],
  );
  await addUsage(session.uid, -Number(file.size_bytes || 0));
  return NextResponse.json({ ok: true });
}
