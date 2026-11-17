import { NextResponse } from 'next/server';
import { initSchema, query, one } from '@/lib/db';
import { readSession, hashPassword, verifyPassword } from '@/lib/auth';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ user: null }, { status: 200 });
  await initSchema();
  const u = await one<{ id: number; email: string; display_name: string; role: string; locale: string; gender: string | null; birth_date: string | null; region: string | null }>(
    'SELECT id, email, display_name, role, locale, gender, birth_date, region FROM users WHERE id = $1', [s.uid]
  );
  return NextResponse.json({ user: u });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name || '').trim();
  if (!name || name.length > 60) return NextResponse.json({ error: 'bad_name' }, { status: 400 });
  await initSchema();
  const gender = ['m', 'f', 'other'].includes(String(b?.gender)) ? String(b.gender) : null;
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.birthDate || '')) ? String(b.birthDate) : null;
  const region = String(b?.region || '').trim().slice(0, 40) || null;
  await query(
    'UPDATE users SET display_name = $2, gender = $3, birth_date = $4, region = $5 WHERE id = $1',
    [s.uid, name, gender, birth, region]
  );
  return NextResponse.json({ ok: true, name, gender, birthDate: birth, region });
}
