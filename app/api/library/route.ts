import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { isLibraryStatus, libraryCounts, listLibrary, setLibraryStatus, toggleLibrary } from '@/lib/repo';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ items: [], counts: {} }, { status: 200 });
  const [items, counts] = await Promise.all([listLibrary(s.uid), libraryCounts(s.uid)]);
  return NextResponse.json({ items, counts });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId);
  if (!workId) return NextResponse.json({ error: 'work_required' }, { status: 400 });

  // Со статусом — «Моя полка» ставит точный статус (в т.ч. 'remove').
  // Без статуса — прежнее поведение кнопки: добавить / убрать.
  const status = b?.status;
  if (status === 'remove' || isLibraryStatus(status)) {
    const result = await setLibraryStatus(s.uid, workId, status);
    return NextResponse.json({ ok: true, status: result, inLibrary: result !== null });
  }

  const inLibrary = await toggleLibrary(s.uid, workId);
  return NextResponse.json({ ok: true, inLibrary, status: inLibrary ? 'want' : null });
}
