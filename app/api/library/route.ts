import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { listLibrary, toggleLibrary } from '@/lib/repo';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ items: [] }, { status: 200 });
  return NextResponse.json({ items: await listLibrary(s.uid) });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const workId = Number(b?.workId);
  if (!workId) return NextResponse.json({ error: 'work_required' }, { status: 400 });
  const inLibrary = await toggleLibrary(s.uid, workId);
  return NextResponse.json({ ok: true, inLibrary });
}
