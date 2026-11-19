import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import {
  addMember, canManageStaff, isMemberRole, listMembers, memberRoleFor, removeMember, setMemberRole,
} from '@/lib/publisher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function whoCan(req: Request) {
  const s = await readSession();
  if (!s) return { error: NextResponse.json({ error: 'auth_required' }, { status: 401 }) };
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return { error: NextResponse.json({ error: scope.error }, { status: scope.status }) };
  const role = scope.isAdmin ? 'owner' : await memberRoleFor(s.uid, scope.publisherId);
  return { session: s, scope, role };
}

export async function GET(req: Request) {
  const r = await whoCan(req);
  if ('error' in r) return r.error;
  const items = await listMembers(r.scope.publisherId);
  return NextResponse.json({ items, my_role: r.role });
}

export async function POST(req: Request) {
  const r = await whoCan(req);
  if ('error' in r) return r.error;
  if (!canManageStaff(r.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email || '').trim();
  const role = String(body?.role || 'member');
  if (!email || !isMemberRole(role)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const res = await addMember(r.scope.publisherId, email, role);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 422 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const r = await whoCan(req);
  if ('error' in r) return r.error;
  if (!canManageStaff(r.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const role = String(body?.role || '');
  if (!Number.isFinite(userId) || !isMemberRole(role)) {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const res = await setMemberRole(r.scope.publisherId, userId, role);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 422 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const r = await whoCan(req);
  if ('error' in r) return r.error;
  if (!canManageStaff(r.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const userId = Number(new URL(req.url).searchParams.get('userId'));
  if (!Number.isFinite(userId)) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const res = await removeMember(r.scope.publisherId, userId);
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 422 });
  return NextResponse.json({ ok: true });
}
