import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { saveProgress } from '@/lib/repo';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId), chapterId = Number(b?.chapterId);
  const position = Math.max(0, Number(b?.position) || 0);
  const percent = Math.min(100, Math.max(0, Number(b?.percent) || 0));
  if (!workId || !chapterId) return NextResponse.json({ ok: false }, { status: 400 });
  await saveProgress(s.uid, workId, chapterId, position, percent);
  return NextResponse.json({ ok: true });
}
