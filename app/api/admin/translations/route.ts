import { NextResponse } from 'next/server';
import { adminTokenOk, ensureAuthor } from '@/lib/admin';
import { listTranslationQueue, reviewTranslation, runTranslationAi } from '@/lib/translation-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — очередь переводов: ждут ИИ или проверки. */
export async function GET(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const requests = await listTranslationQueue();
  return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST — { id, action: 'run' | 'approve' | 'reject', comment? } */
export async function POST(req: Request) {
  if (!adminTokenOk(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const action = String(b?.action || '');
  if (!id || !['run', 'approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  if (action === 'run') {
    const r = await runTranslationAi(id);
    if (!r.ok) {
      return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.error === 'failed' ? 502 : 409 });
    }
    return NextResponse.json({ ok: true, model: r.model });
  }

  const reviewerId = await ensureAuthor();
  const r = await reviewTranslation({
    id,
    approve: action === 'approve',
    reviewerId,
    comment: b?.comment ? String(b.comment).slice(0, 500) : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 409 });
  return NextResponse.json({ ok: true, status: r.status });
}
