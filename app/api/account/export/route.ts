import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { exportAccount } from '@/lib/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const data = await exportAccount(s.uid);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="podaci-${s.uid}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
