import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { computePayout, taxOpts } from '@/lib/taxes';

export const dynamic = 'force-dynamic';

/** GET /api/author/payouts/preview?amount=NNN — разбивка до подачи заявки (ТЗ 5.5). */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const amount = Number(new URL(req.url).searchParams.get('amount') || 0);
  const b = computePayout(amount, taxOpts());
  return NextResponse.json(b, { headers: { 'Cache-Control': 'no-store' } });
}
