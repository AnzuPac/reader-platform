import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { one } from '@/lib/db';
import { chapterGate } from '@/lib/purchases';
import { signChapterToken } from '@/lib/content-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const chapterId = Number(body?.chapterId);
  if (!Number.isFinite(chapterId)) return NextResponse.json({ error: 'chapter_required' }, { status: 400, headers: NO_STORE });

  const chapter = await one<{ id: number; work_id: number; access: string }>(
    'SELECT id, work_id, access FROM chapters WHERE id = $1 AND status = $2', [chapterId, 'published'],
  );
  if (!chapter) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

  const gate = await chapterGate(chapter, session);
  if (!gate.allowed) return NextResponse.json({ error: 'locked', reason: gate.reason }, { status: 403, headers: NO_STORE });

  const { token, exp } = signChapterToken(session.uid, chapterId);
  return NextResponse.json({ token, exp }, { headers: NO_STORE });
}
