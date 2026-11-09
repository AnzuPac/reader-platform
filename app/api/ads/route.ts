import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { getAdSlot, isSubscriber } from '@/lib/ads';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get('slot') || '';
  if (!slot) return NextResponse.json({ html: '' });
  const s = await readSession();
  if (s && (await isSubscriber(s.uid))) return NextResponse.json({ html: '', reason: 'subscriber' });
  const ad = await getAdSlot(slot);
  return NextResponse.json({ html: ad?.html || '' });
}
