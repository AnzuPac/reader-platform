import { NextResponse } from 'next/server';
import { adminTokenOk, ensureAuthor } from '@/lib/admin';
import { listPendingEdits, reviewChapterEdit } from '@/lib/chapter-edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — заявки на правку опубликованных глав, ожидающие решения. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const requests = await listPendingEdits();
  return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST — { id, action: 'approve' | 'reject', comment? } */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const action = String(b?.action || '');
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  const reviewerId = await ensureAuthor();
  const r = await reviewChapterEdit({
    id,
    approve: action === 'approve',
    reviewerId,
    comment: b?.comment ? String(b.comment).slice(0, 500) : null,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 409 });
  }
  return NextResponse.json({ ok: true, status: r.status });
}
