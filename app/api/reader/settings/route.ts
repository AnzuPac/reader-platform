import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { getReaderSettings, saveReaderSettings } from '@/lib/reader-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const prefs = await getReaderSettings(s.uid);
  return NextResponse.json({ prefs }, { headers: NO_STORE });
}

export async function PUT(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad_payload' }, { status: 400, headers: NO_STORE });
  const prefs = await saveReaderSettings(s.uid, body);
  return NextResponse.json({ ok: true, prefs }, { headers: NO_STORE });
}
