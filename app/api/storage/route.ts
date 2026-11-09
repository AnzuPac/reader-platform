import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { initSchema, query, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { getQuota } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const quota = await getQuota(s.uid);
  const files = await query(
    `SELECT id, path, bytes, mime, kind, created_at FROM storage_files
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [s.uid]
  );
  return NextResponse.json({ quota, files });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  await initSchema();
  const quota = await getQuota(s.uid);
  if (quota.used + file.size > quota.limit) {
    return NextResponse.json({ error: 'quota_exceeded', quota }, { status: 413 });
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'data', 'storage', String(s.uid));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const rows = await query<{ id: number }>(
    `INSERT INTO storage_files (user_id, path, bytes, mime, kind)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [s.uid, `${s.uid}/${name}`, file.size, file.type || 'application/octet-stream', 'scan']
  );
  await query('UPDATE users SET storage_used = storage_used + $2 WHERE id = $1', [s.uid, file.size]);

  const after = await getQuota(s.uid);
  return NextResponse.json({ ok: true, id: rows[0].id, quota: after });
}

export async function DELETE(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  await initSchema();
  const f = await one<{ path: string; bytes: number }>(
    'SELECT path, bytes FROM storage_files WHERE id = $1 AND user_id = $2', [id, s.uid]
  );
  if (!f) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await unlink(path.join(process.cwd(), 'data', 'storage', f.path)).catch(() => {});
  await query('DELETE FROM storage_files WHERE id = $1', [id]);
  await query('UPDATE users SET storage_used = MAX(0, storage_used - $2) WHERE id = $1', [s.uid, f.bytes]);
  return NextResponse.json({ ok: true, quota: await getQuota(s.uid) });
}
