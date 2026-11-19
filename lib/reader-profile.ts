import { initSchema, one, query } from './db';

/**
 * Профиль читателя: публичная витрина активности с серверной приватностью.
 *
 * Все счётчики берутся из реальных таблиц. «Прочитанные главы» — это
 * РАЗНЫЕ главы, которые пользователь открывал (reading_events), а не номер
 * последней главы: иначе статистика врала бы.
 */

export type Privacy = {
  publicProfile: boolean;
  showHistory: boolean;
  showLibrary: boolean;
  showBookmarks: boolean;
  showAchievements: boolean;
  showGenres: boolean;
};

export type ProfileUser = {
  id: number;
  name: string;
  role: string;
  bio: string | null;
  avatar: string | null;
  cover: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  profilePublic: boolean;
};

export type HistoryItem = {
  workId: number;
  slug: string;
  title: string;
  author: string;
  cover: string | null;
  chapterId: number | null;
  chapterTitle: string | null;
  percent: number;
  updatedAt: string;
};

export type BookmarkItem = {
  id: number;
  workId: number;
  slug: string;
  title: string;
  chapterId: number;
  chapterTitle: string | null;
  note: string | null;
  position: number;
  createdAt: string;
};

export type AchievementItem = {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
};

export type ReaderStats = {
  chapters: number;
  works: number;
  bookmarks: number;
  library: Record<string, number>;
  achievements: number;
};

export type SubscriptionOverview = {
  planCode: string;
  planName: string;
  status: string;
  periodEnd: string;
  autoRenew: boolean;
} | null;

const PRIVACY_DEFAULTS: Privacy = {
  publicProfile: true,
  showHistory: true,
  showLibrary: true,
  showBookmarks: true,
  showAchievements: true,
  showGenres: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0') return false;
  return fallback;
}

async function ensure() {
  await initSchema();
}

/** Приватность из user_profile; если строки нет — публичные значения по умолчанию. */
export async function getPrivacy(userId: number): Promise<Privacy> {
  await ensure();
  const row = await one<Record<string, unknown>>(
    'SELECT public_profile, show_history, show_library, show_bookmarks, show_achievements, show_genres FROM user_profile WHERE user_id = $1',
    [userId],
  ).catch(() => null);
  if (!row) return { ...PRIVACY_DEFAULTS };
  return {
    publicProfile: asBool(row.public_profile, true),
    showHistory: asBool(row.show_history, true),
    showLibrary: asBool(row.show_library, true),
    showBookmarks: asBool(row.show_bookmarks, true),
    showAchievements: asBool(row.show_achievements, true),
    showGenres: asBool(row.show_genres, true),
  };
}

export async function getUserCard(userId: number): Promise<ProfileUser | null> {
  await ensure();
  const row = await one<Record<string, unknown>>(
    `SELECT u.id, u.display_name, u.role, u.bio, u.avatar_path, u.created_at, u.last_seen_at,
            u.profile_public, p.cover_url
       FROM users u LEFT JOIN user_profile p ON p.user_id = u.id
      WHERE u.id = $1 AND u.status = 'active' AND u.deleted_at IS NULL`,
    [userId],
  );
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.display_name),
    role: String(row.role),
    bio: (row.bio as string | null) ?? null,
    avatar: (row.avatar_path as string | null) ?? null,
    cover: (row.cover_url as string | null) ?? null,
    createdAt: String(row.created_at),
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    profilePublic: asBool(row.profile_public, true),
  };
}

export async function getStats(userId: number): Promise<ReaderStats> {
  await ensure();
  const chapters = await one<{ n: number }>(
    'SELECT COUNT(DISTINCT chapter_id) AS n FROM reading_events WHERE user_id = $1 AND chapter_id IS NOT NULL',
    [userId],
  ).catch(() => ({ n: 0 }));
  const works = await one<{ n: number }>(
    'SELECT COUNT(DISTINCT work_id) AS n FROM reading_events WHERE user_id = $1',
    [userId],
  ).catch(() => ({ n: 0 }));
  const marks = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = $1',
    [userId],
  ).catch(() => ({ n: 0 }));
  const lib = await query<{ status: string; n: number }>(
    'SELECT status, COUNT(*) AS n FROM library_items WHERE user_id = $1 GROUP BY status',
    [userId],
  ).catch(() => []);
  const ach = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM user_achievements WHERE user_id = $1',
    [userId],
  ).catch(() => ({ n: 0 }));
  const library: Record<string, number> = {};
  for (const r of lib) library[String(r.status)] = Number(r.n);
  return {
    chapters: Number(chapters?.n || 0),
    works: Number(works?.n || 0),
    bookmarks: Number(marks?.n || 0),
    library,
    achievements: Number(ach?.n || 0),
  };
}

export async function getHistory(userId: number, limit = 20): Promise<HistoryItem[]> {
  await ensure();
  const rows = await query<Record<string, unknown>>(
    `SELECT rp.work_id, rp.chapter_id, rp.percent, rp.updated_at,
            w.slug, w.title, w.cover_path, u.display_name AS author_name,
            c.title AS chapter_title
       FROM reading_progress rp
       JOIN works w ON w.id = rp.work_id
       JOIN users u ON u.id = w.author_id
       LEFT JOIN chapters c ON c.id = rp.chapter_id
      WHERE rp.user_id = $1
      ORDER BY rp.updated_at DESC
      LIMIT $2`,
    [userId, limit],
  ).catch(() => []);
  return rows.map((r) => ({
    workId: Number(r.work_id),
    slug: String(r.slug),
    title: String(r.title),
    author: String(r.author_name),
    cover: (r.cover_path as string | null) ?? null,
    chapterId: r.chapter_id == null ? null : Number(r.chapter_id),
    chapterTitle: (r.chapter_title as string | null) ?? null,
    percent: Number(r.percent || 0),
    updatedAt: String(r.updated_at),
  }));
}

export async function getBookmarks(userId: number, limit = 50): Promise<BookmarkItem[]> {
  await ensure();
  const rows = await query<Record<string, unknown>>(
    `SELECT b.id, b.chapter_id, b.position, b.note, b.created_at,
            c.work_id, c.title AS chapter_title,
            w.slug, w.title
       FROM bookmarks b
       JOIN chapters c ON c.id = b.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2`,
    [userId, limit],
  ).catch(() => []);
  return rows.map((r) => ({
    id: Number(r.id),
    workId: Number(r.work_id),
    slug: String(r.slug),
    title: String(r.title),
    chapterId: Number(r.chapter_id),
    chapterTitle: (r.chapter_title as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    position: Number(r.position || 0),
    createdAt: String(r.created_at),
  }));
}

export async function getAchievements(userId: number, lang: 'sr' | 'ru' | 'en'): Promise<AchievementItem[]> {
  await ensure();
  const defs = await query<Record<string, unknown>>(
    'SELECT key, title_sr, title_ru, title_en, desc_sr, desc_ru, desc_en, icon, category, threshold FROM achievement_definitions WHERE enabled = TRUE ORDER BY threshold, key',
  ).catch(() => []);
  const mine = await query<Record<string, unknown>>(
    'SELECT achievement_key, unlocked_at, progress FROM user_achievements WHERE user_id = $1',
    [userId],
  ).catch(() => []);
  const byKey = new Map(mine.map((m) => [String(m.achievement_key), m]));
  const titleKey = `title_${lang}`;
  const descKey = `desc_${lang}`;
  return defs.map((d) => {
    const m = byKey.get(String(d.key));
    return {
      key: String(d.key),
      title: String(d[titleKey] ?? d.title_en ?? d.key),
      description: String(d[descKey] ?? d.desc_en ?? ''),
      icon: String(d.icon || '★'),
      category: String(d.category || 'reading'),
      threshold: Number(d.threshold || 1),
      progress: m ? Number(m.progress || 0) : 0,
      unlockedAt: (m?.unlocked_at as string | null) ?? null,
    };
  });
}

export async function getFavoriteGenres(userId: number, limit = 5): Promise<{ slug: string; name: string; count: number }[]> {
  await ensure();
  const rows = await query<Record<string, unknown>>(
    `SELECT g.slug, g.name_sr, g.name_en, g.name_ru, COUNT(DISTINCT re.work_id) AS n
       FROM reading_events re
       JOIN work_genres wg ON wg.work_id = re.work_id
       JOIN genres g ON g.id = wg.genre_id
      WHERE re.user_id = $1
      GROUP BY g.id, g.slug, g.name_sr, g.name_en, g.name_ru
      ORDER BY n DESC, g.slug
      LIMIT $2`,
    [userId, limit],
  ).catch(() => []);
  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name_sr),
    count: Number(r.n),
  }));
}

export async function getSubscription(userId: number): Promise<SubscriptionOverview> {
  await ensure();
  const row = await one<Record<string, unknown>>(
    `SELECT s.plan_code, s.status, s.current_period_end, s.auto_renew, p.name
       FROM subscriptions s JOIN plans p ON p.code = s.plan_code
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC LIMIT 1`,
    [userId],
  ).catch(() => null);
  if (!row) return null;
  return {
    planCode: String(row.plan_code),
    planName: String(row.name),
    status: String(row.status),
    periodEnd: String(row.current_period_end),
    autoRenew: asBool(row.auto_renew, true),
  };
}

export async function getPublicCollections(userId: number) {
  await ensure();
  return query<{ slug: string; title: string }>(
    'SELECT slug, title FROM collections WHERE owner_id = $1 AND is_public = 1 ORDER BY position, id LIMIT 6',
    [userId],
  ).catch(() => []);
}

/** Просмотр главы: событие идемпотентно в пределах часа на ту же главу. */
export async function recordReadingEvent(userId: number, workId: number, chapterId: number | null): Promise<void> {
  await ensure();
  try {
    if (chapterId) {
      const recent = await one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM reading_events
          WHERE user_id = $1 AND chapter_id = $2 AND created_at >= ${process.env.DATABASE_URL ? "NOW() - INTERVAL '1 hour'" : "datetime('now','-1 hour')"}`,
        [userId, chapterId],
      );
      if (Number(recent?.n || 0) > 0) return;
    }
    await query(
      'INSERT INTO reading_events (user_id, work_id, chapter_id, event_type) VALUES ($1,$2,$3,$4)',
      [userId, workId, chapterId, 'opened'],
    );
  } catch {
    /* статистика не должна ломать чтение */
  }
}

/** Достижения выдаются серверно и идемпотентно. Возвращает новые ключи. */
export async function evaluateAchievements(userId: number): Promise<string[]> {
  await ensure();
  const stats = await getStats(userId);
  const defs = await query<{ key: string; threshold: number }>(
    'SELECT key, threshold FROM achievement_definitions WHERE enabled = TRUE',
  ).catch(() => []);
  const earned = new Set(
    (await query<{ achievement_key: string }>('SELECT achievement_key FROM user_achievements WHERE user_id = $1', [userId]).catch(() => []))
      .map((r) => String(r.achievement_key)),
  );
  const counters: Record<string, number> = {
    first_read: stats.chapters >= 1 ? 1 : 0,
    chapters_10: stats.chapters,
    chapters_50: stats.chapters,
    chapters_100: stats.chapters,
    first_bookmark: stats.bookmarks >= 1 ? 1 : 0,
    library_first: Object.values(stats.library).reduce((a, b) => a + b, 0) >= 1 ? 1 : 0,
    first_completed: (stats.library.done || 0) >= 1 ? 1 : 0,
  };
  const unlocked: string[] = [];
  for (const d of defs) {
    const key = String(d.key);
    const threshold = Number(d.threshold || 1);
    const value = counters[key] ?? 0;
    if (earned.has(key) || value < threshold) continue;
    try {
      await query(
        'INSERT INTO user_achievements (user_id, achievement_key, progress) VALUES ($1,$2,$3) ON CONFLICT (user_id, achievement_key) DO NOTHING',
        [userId, key, value],
      );
      unlocked.push(key);
    } catch { /* повторная выдача не критична */ }
  }
  return unlocked;
}

export type ProfileExtrasInput = {
  bio?: string;
  coverUrl?: string | null;
  privacy?: Partial<Privacy>;
};

/** Расширенная правка: обложка и приватность. Только владелец (проверка в API). */
export async function updateProfileExtras(userId: number, input: ProfileExtrasInput): Promise<boolean> {
  await ensure();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof input.bio === 'string') {
    params.push(input.bio.slice(0, 1000));
    sets.push(`bio = $${params.length}`);
  }
  if (input.coverUrl === null) {
    sets.push('cover_url = NULL');
  } else if (typeof input.coverUrl === 'string') {
    if (!input.coverUrl.startsWith('/uploads/') && !input.coverUrl.startsWith('https://')) return false;
    params.push(input.coverUrl.slice(0, 500));
    sets.push(`cover_url = $${params.length}`);
  }
  const p = input.privacy;
  if (p) {
    const map: [keyof Privacy, string][] = [
      ['publicProfile', 'public_profile'],
      ['showHistory', 'show_history'],
      ['showLibrary', 'show_library'],
      ['showBookmarks', 'show_bookmarks'],
      ['showAchievements', 'show_achievements'],
      ['showGenres', 'show_genres'],
    ];
    for (const [key, col] of map) {
      if (typeof p[key] === 'boolean') {
        params.push(p[key] ? 1 : 0);
        sets.push(`${col} = $${params.length}`);
      }
    }
  }
  if (!sets.length) return true;
  params.push(userId);
  try {
    await query(`INSERT INTO user_profile (user_id) VALUES ($${params.length}) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    await query(`UPDATE user_profile SET ${sets.join(', ')}, updated_at = ${process.env.DATABASE_URL ? 'NOW()' : "datetime('now')"} WHERE user_id = $${params.length}`, params);
    return true;
  } catch {
    return false;
  }
}
