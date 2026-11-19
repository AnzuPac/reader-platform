import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/profiles';
import { updateProfileExtras, getPrivacy } from '@/lib/reader-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Свой профиль: чтение и правка (био, аватар, публичность, имя). */
export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const profile = await getProfile(s.uid);
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const extras = await updateProfileExtras(s.uid, {
    bio: typeof body?.bio === 'string' ? body.bio : undefined,
    coverUrl: body?.coverUrl === null ? null : (typeof body?.coverUrl === 'string' ? body.coverUrl : undefined),
    privacy: body?.privacy && typeof body.privacy === 'object' ? body.privacy : undefined,
  });
  if (!extras) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  const ok = await updateProfile(s.uid, {
    name: typeof body?.name === 'string' ? body.name : undefined,
    bio: typeof body?.bio === 'string' ? body.bio : undefined,
    avatarPath: body?.avatarPath === null ? null : (typeof body?.avatarPath === 'string' ? body.avatarPath : undefined),
    isPublic: typeof body?.isPublic === 'boolean' ? body.isPublic : undefined,
  });
  if (!ok) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  return NextResponse.json({ ok: true, privacy: await getPrivacy(s.uid) });
}
