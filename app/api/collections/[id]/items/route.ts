import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { addWorkToCollection, removeWorkFromCollection, reorderCollection } from '@/lib/collections';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function collectionId(params: Promise<{ id: string }>): Promise<number> {
  const id = Number((await params).id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `collection-items:${s.uid}`), 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const id = await collectionId(params);
  const body = await req.json().catch(() => null);
  const workId = Number(body?.workId);
  if (!id || !workId) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await addWorkToCollection({ uid: s.uid, role: s.role }, id, workId);
  if (!ok) return NextResponse.json({ error: 'forbidden_or_missing' }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const id = await collectionId(params);
  const body = await req.json().catch(() => null);
  const workId = Number(body?.workId);
  if (!id || !workId) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await removeWorkFromCollection({ uid: s.uid, role: s.role }, id, workId);
  if (!ok) return NextResponse.json({ error: 'forbidden_or_missing' }, { status: 403 });
  return NextResponse.json({ ok: true });
}

/** Порядок работ: {"workIds":[3,1,2]}. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const id = await collectionId(params);
  const body = await req.json().catch(() => null);
  const workIds = Array.isArray(body?.workIds) ? body.workIds.map(Number).filter(Number.isFinite) : null;
  if (!id || !workIds) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await reorderCollection({ uid: s.uid, role: s.role }, id, workIds);
  if (!ok) return NextResponse.json({ error: 'forbidden_or_missing' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
