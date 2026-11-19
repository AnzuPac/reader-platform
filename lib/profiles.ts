import { initSchema, one, query } from './db';

/**
 * Профили пользователей и авторов.
 *
 * Приватность: profile_public = 0 — профиль не открывается посторонним,
 * но собственные данные человек видит всегда. Дата рождения наружу не отдаётся.
 */

export type PublicProfile = {
  id: number;
  name: string;
  role: string;
  bio: string | null;
  avatar_path: string | null;
  profile_public: number | boolean;
  created_at: string;
};

export type ProfileViewer = { uid: number; role: string } | null;

async function ensure() {
  await initSchema();
}

export function isPublic(profile: Pick<PublicProfile, 'profile_public'>): boolean {
  return profile.profile_public === true || profile.profile_public === 1;
}

export async function getProfile(userId: number): Promise<PublicProfile | null> {
  await ensure();
  return one<PublicProfile>(
    `SELECT id, display_name AS name, role, bio, avatar_path, profile_public, created_at
       FROM users WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
    [userId],
  );
}

export function canViewProfile(profile: PublicProfile, viewer: ProfileViewer): boolean {
  if (isPublic(profile)) return true;
  if (!viewer) return false;
  if (viewer.uid === profile.id) return true;
  return viewer.role === 'admin' || viewer.role === 'moderator';
}

export async function listPublishedWorks(authorId: number) {
  await ensure();
  return query<{ id: number; slug: string; title: string; cover_path: string | null; rating_avg: string; completion: string }>(
    `SELECT id, slug, title, cover_path, rating_avg, completion
       FROM works WHERE author_id = $1 AND status = 'published'
      ORDER BY published_at DESC, id DESC`,
    [authorId],
  );
}

export type UpdateInput = { bio?: string; avatarPath?: string | null; isPublic?: boolean; name?: string };

export async function updateProfile(userId: number, input: UpdateInput): Promise<boolean> {
  await ensure();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (typeof input.name === 'string' && input.name.trim()) {
    params.push(input.name.trim().slice(0, 80));
    sets.push(`display_name = $${params.length}`);
  }
  if (typeof input.bio === 'string') {
    params.push(input.bio.slice(0, 1000));
    sets.push(`bio = $${params.length}`);
  }
  if (input.avatarPath === null) {
    sets.push('avatar_path = NULL');
  } else if (typeof input.avatarPath === 'string') {
    // Только собственные загрузки: /uploads/... — внешние URL не принимаем,
    // иначе профиль превращается в рекламный баннер.
    if (!input.avatarPath.startsWith('/uploads/')) return false;
    params.push(input.avatarPath.slice(0, 300));
    sets.push(`avatar_path = $${params.length}`);
  }
  if (typeof input.isPublic === 'boolean') {
    params.push(input.isPublic ? 1 : 0);
    sets.push(`profile_public = $${params.length}`);
  }

  if (!sets.length) return true;
  params.push(userId);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return true;
}

/** Публичная статистика профиля: произведения, подписчики, читатели. */
export async function profileStats(userId: number): Promise<{ works: number; followers: number; readers: number }> {
  await ensure();
  const w = await one<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM works WHERE author_id = $1 AND status = 'published'", [userId],
  );
  const f = await one<{ n: number | string }>(
    'SELECT COUNT(*) AS n FROM author_follows WHERE author_id = $1', [userId],
  );
  const r = await one<{ n: number | string }>(
    `SELECT COUNT(DISTINCT p.user_id) AS n
       FROM reading_progress p JOIN works w ON w.id = p.work_id
      WHERE w.author_id = $1`, [userId],
  );
  return { works: Number(w?.n ?? 0), followers: Number(f?.n ?? 0), readers: Number(r?.n ?? 0) };
}
