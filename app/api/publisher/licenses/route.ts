import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import {
  EXPORT_POLICIES, canEditLicenses, getLicense, memberRoleFor, upsertLicense,
} from '@/lib/publisher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Лицензия на произведение: территория, срок, права. */
export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const workId = Number(new URL(req.url).searchParams.get('workId'));
  if (!Number.isFinite(workId) || workId <= 0) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const license = await getLicense(workId, scope.publisherId);
  const role = scope.isAdmin ? 'owner' : await memberRoleFor(s.uid, scope.publisherId);
  return NextResponse.json({ license, my_role: role, export_policies: EXPORT_POLICIES });
}

export async function PUT(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const role = scope.isAdmin ? 'owner' : await memberRoleFor(s.uid, scope.publisherId);
  if (!canEditLicenses(role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const workId = Number(body?.workId);
  if (!Number.isFinite(workId) || workId <= 0) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await upsertLicense(workId, scope.publisherId, {
    territory: typeof body?.territory === 'string' ? body.territory : 'RS',
    starts_at: typeof body?.startsAt === 'string' ? body.startsAt : null,
    ends_at: typeof body?.endsAt === 'string' ? body.endsAt : null,
    rights_sale: Boolean(body?.rightsSale),
    rights_subscription: Boolean(body?.rightsSubscription),
    rights_library: Boolean(body?.rightsLibrary),
    tts_allowed: Boolean(body?.tts),
    translit_allowed: Boolean(body?.translit),
    export_policy: typeof body?.exportPolicy === 'string' ? body.exportPolicy : 'disallowed',
  });
  if (!ok) return NextResponse.json({ error: 'work_not_in_publisher' }, { status: 422 });

  return NextResponse.json({ ok: true, license: await getLicense(workId, scope.publisherId) });
}
