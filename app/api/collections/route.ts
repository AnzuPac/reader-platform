import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { createCollection, ensureSystemCollections, listCollections, type CollectionKind } from '@/lib/collections';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await readSession();
  await ensureSystemCollections();
  const items = await listCollections(s ? { uid: s.uid, role: s.role } : null);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `collection-create:${s.uid}`), 10, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const title = String(body?.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  // Редакционную коллекцию может создать только редактор/админ.
  const requested = String(body?.kind || 'user') as CollectionKind;
  const kind: CollectionKind =
    (requested === 'editorial' || requested === 'system') && (s.role === 'admin' || s.role === 'moderator')
      ? requested
      : 'user';

  try {
    const collection = await createCollection(s.uid, {
      title,
      description: typeof body?.description === 'string' ? body.description : '',
      isPublic: body?.isPublic !== false,
      kind,
    });
    return NextResponse.json({ ok: true, collection });
  } catch {
    return NextResponse.json({ error: 'create_failed' }, { status: 400 });
  }
}
