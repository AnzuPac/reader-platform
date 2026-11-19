import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { deleteCollection, updateCollection } from '@/lib/collections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const ok = await updateCollection({ uid: s.uid, role: s.role }, id, {
    title: typeof body?.title === 'string' ? body.title : undefined,
    description: typeof body?.description === 'string' ? body.description : undefined,
    isPublic: typeof body?.isPublic === 'boolean' ? body.isPublic : undefined,
  });
  if (!ok) return NextResponse.json({ error: 'forbidden_or_missing' }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const ok = await deleteCollection({ uid: s.uid, role: s.role }, id);
  if (!ok) return NextResponse.json({ error: 'forbidden_or_missing' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
