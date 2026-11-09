import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { initSchema, one } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const { id } = await ctx.params;
  await initSchema();
  const f = await one<{ path: string; mime: string }>(
    'SELECT path, mime FROM storage_files WHERE id = $1 AND user_id = $2', [Number(id), s.uid]
  );
  if (!f) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const buf = await readFile(path.join(process.cwd(), 'data', 'storage', f.path));
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': f.mime, 'Content-Disposition': 'inline' },
    });
  } catch {
    return NextResponse.json({ error: 'missing' }, { status: 404 });
  }
}
