import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { saveProgress } from '@/lib/repo';

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId);
  const chapterId = Number(b?.chapterId);
  const position = Math.max(0, Number(b?.position) || 0);
  const percent = Math.min(100, Math.max(0, Number(b?.percent) || 0));

  if (!Number.isFinite(workId) || !Number.isFinite(chapterId) || workId <= 0 || chapterId <= 0) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // saveProgress проверяет, что глава принадлежит произведению.
  const saved = await saveProgress(s.uid, workId, chapterId, position, percent);
  if (!saved) {
    return NextResponse.json({ ok: false, error: 'chapter_not_in_work' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
