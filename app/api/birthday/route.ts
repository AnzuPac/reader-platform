import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { claimGift, giftStatus } from '@/lib/birthday';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Статус подарка: включён ли, сегодня ли день рождения, получен ли уже. */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const rl = await rateLimit(`birthday-status:${s.uid}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429 });

  const status = await giftStatus(s.uid);
  return NextResponse.json({
    ok: true,
    enabled: status.config.enabled,
    coins: status.config.coins,
    eligible: status.eligible,
    claimedThisYear: status.claimedThisYear,
    hasBirthDate: status.hasBirthDate,
    daysUntilBirthday: status.daysUntilBirthday,
  });
}

/** Забрать подарок. Только по явному действию, один раз в год. */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const rl = await rateLimit(clientKey(req, `birthday-claim:${s.uid}`), 5, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'too_many_attempts' }, { status: 429 });

  const res = await claimGift(s.uid);
  if (res.ok) return NextResponse.json({ ok: true, coins: res.coins });
  return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
}
