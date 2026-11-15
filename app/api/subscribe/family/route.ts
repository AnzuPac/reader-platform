import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { readSession } from '@/lib/auth';
import {
  activeSubscription, addFamilyMemberByEmail, familyMembers, removeFamilyMember, FAMILY_MAX_PROFILES,
} from '@/lib/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/subscribe/family — профили семейной подписки. */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const sub = await activeSubscription(s.uid);
  const members = sub?.plan_code === 'family' ? await familyMembers(s.uid) : [];
  return NextResponse.json({ plan: sub?.plan_code ?? null, max_profiles: FAMILY_MAX_PROFILES, members });
}

/** POST /api/subscribe/family {email} — добавить профиль (лимит 5, включая владельца). */
export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const b = await req.json().catch(() => null);
  const res = await addFamilyMemberByEmail(s.uid, String(b?.email || ''));
  if (!res.ok) {
    const status = res.error === 'user_not_found' ? 404 : res.error === 'limit_reached' ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, count: res.count, max_profiles: FAMILY_MAX_PROFILES });
}

/** DELETE /api/subscribe/family?userId=... — убрать профиль. */
export async function DELETE(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  await initSchema();
  const memberId = Number(new URL(req.url).searchParams.get('userId'));
  if (!memberId) return NextResponse.json({ error: 'user_required' }, { status: 400 });
  await removeFamilyMember(s.uid, memberId);
  return NextResponse.json({ ok: true });
}
