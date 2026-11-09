import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: { id: s.uid, email: s.email, name: s.name, role: s.role } });
}
