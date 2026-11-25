import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import {
  detectFormat, saveUserFile, usageFor, quotaFor, addUsage, MAX_FILE_BYTES,
} from '@/lib/user-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const books = await query<{
    book_id: number; title: string; author: string | null; format: string; status: string; created_at: string;
    file_id: number; size_bytes: number | string; mime: string | null; storage: string; file_status: string;
  }>(
    `SELECT b.id AS book_id, b.title, b.author, b.format, b.status, b.created_at,
            f.id AS file_id, f.size_bytes, f.mime, f.storage, f.status AS file_status
       FROM user_books b
       LEFT JOIN user_book_files f ON f.user_book_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC`,
    [session.uid],
  );

  const [usage, quota] = await Promise.all([usageFor(session.uid), quotaFor(session.uid)]);
  return NextResponse.json({
    books,
    usage,
    quota,
    maxFileBytes: MAX_FILE_BYTES,
    allowed: ['epub', 'fb2', 'txt', 'pdf', 'cbz', 'cbr'],
  });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, 'user-upload'), 20, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_uploads', retryAfter: rl.retryAfter }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_FILE_BYTES }, { status: 413 });
  }

  const name = String(file.name || '');
  const ext = (name.split('.').pop() || '').toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const check = detectFormat(buffer, ext);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const [usage, quota] = await Promise.all([usageFor(session.uid), quotaFor(session.uid)]);
  if (usage + buffer.length > quota) {
    return NextResponse.json({ error: 'quota_exceeded', usage, quota }, { status: 413 });
  }

  const { rel, sha256 } = await saveUserFile(session.uid, buffer, check.format);
  const title = name.replace(/\.[^.]+$/, '').slice(0, 300) || 'Без названия';

  const bookRows = await query<{ id: number }>(
    `INSERT INTO user_books (user_id, title, author, format, status) VALUES ($1,$2,$3,$4,'ready') RETURNING id`,
    [session.uid, title, null, check.format],
  );
  const bookId = bookRows[0].id;
  const fileRows = await query<{ id: number }>(
    `INSERT INTO user_book_files (user_book_id, storage, path, size_bytes, mime, sha256, status)
     VALUES ($1,'cloud',$2,$3,$4,$5,'ready') RETURNING id`,
    [bookId, rel, buffer.length, check.mime, sha256],
  );
  await addUsage(session.uid, buffer.length);

  return NextResponse.json({
    ok: true,
    book: { id: bookId, title, format: check.format, size: buffer.length },
    fileId: fileRows[0].id,
    usage: usage + buffer.length,
    quota,
  });
}
