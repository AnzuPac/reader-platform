import { NextResponse } from 'next/server';
import { readSession, signDeleteToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const token = await signDeleteToken(s.uid);
  return NextResponse.json({ ok: true, token, expires_in: 900 }, { headers: { 'Cache-Control': 'no-store' } });
}
