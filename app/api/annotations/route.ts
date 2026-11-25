import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { initSchema, one } from '@/lib/db';
import { chapterGate } from '@/lib/purchases';
import { createAnnotation, deleteAnnotation, listAnnotations } from '@/lib/annotations';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const chapterId = Number(new URL(req.url).searchParams.get('chapter'));
  if (!Number.isFinite(chapterId) || chapterId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });
  }
  const items = await listAnnotations(s.uid, chapterId);
  return NextResponse.json({ annotations: items }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const rl = await rateLimit(clientKey(req, `annotations:${s.uid}`), 120, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  const chapterId = Number(body?.chapterId);
  if (!Number.isFinite(chapterId) || chapterId <= 0) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });
  }

  await initSchema();
  const ch = await one<{ id: number; work_id: number; access: string }>(
    'SELECT id, work_id, access FROM chapters WHERE id = $1 AND status = $2', [chapterId, 'published'],
  );
  if (!ch) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  const gate = await chapterGate(ch, s);
  if (!gate.allowed) return NextResponse.json({ error: 'locked', reason: gate.reason }, { status: 403, headers: NO_STORE });

  const created = await createAnnotation(s.uid, chapterId, {
    position: Number(body?.position), length: Number(body?.length),
    note: body?.note ? String(body.note) : null,
    color: body?.color ? String(body.color) : null,
  });
  return NextResponse.json({ ok: true, annotation: created }, { headers: NO_STORE });
}

export async function DELETE(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const id = String(new URL(req.url).searchParams.get('id') || '');
  if (!id) return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });
  const ok = await deleteAnnotation(s.uid, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: NO_STORE });
}
