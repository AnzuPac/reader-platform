import { initSchema, query } from './db';
import { maskSmallBuckets } from './age';

/**
 * Статистика автора по произведениям — сводка для личного кабинета.
 *
 * Считаем по профилю читателя (пол, возраст из даты рождения, регион),
 * по прогрессу чтения (докуда дочитали), а также закладки, подписчиков и покупки.
 * Где данных нет — честно «не указано», а не выдуманная доля.
 */

export type GenderSplit = { m: number; f: number; other: number; unknown: number };
export type WorkStats = {
  id: number; slug: string; title: string;
  readers: number; readers7: number; readers30: number;
  gender: GenderSplit;
  age: Record<string, number>;
  region: Record<string, number>;
  furthestChapter: number | null;
  avgPercent: number;
  bookmarks: number;
  subscribers: number;
  purchases: number;
  purchasesSum: number;
};

export type AuthorStats = {
  works: WorkStats[];
  totals: {
    readers: number; bookmarks: number; subscribers: number;
    purchases: number; purchasesSum: number;
  };
};

const AGE_BUCKETS = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'не указан'];

export function ageBucket(birthDate: string | null | undefined, now = new Date()): string {
  if (!birthDate) return 'не указан';
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 'не указан';
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 120) return 'не указан';
  if (age < 18) return '<18';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

type ReaderRow = { work_id: number; gender: string | null; birth_date: string | null; region: string | null; locale: string };

export async function getAuthorStats(authorId: number, now = new Date()): Promise<AuthorStats> {
  await initSchema();

  const works = await query<{ id: number; slug: string; title: string }>(
    'SELECT id, slug, title FROM works WHERE author_id = $1 ORDER BY updated_at DESC', [authorId]
  );
  if (!works.length) {
    return { works: [], totals: { readers: 0, bookmarks: 0, subscribers: 0, purchases: 0, purchasesSum: 0 } };
  }

  // Читатели с профилем: по строке на пару (произведение, читатель).
  const readers = await query<ReaderRow>(
    `SELECT p.work_id, u.gender, u.birth_date, u.region, u.locale
       FROM reading_progress p
       JOIN users u ON u.id = p.user_id
       JOIN works w ON w.id = p.work_id
      WHERE w.author_id = $1
      GROUP BY p.work_id, u.id`, [authorId]
  );

  const cut = (days: number) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const active = await query<{ work_id: number; readers7: number; readers30: number }>(
    `SELECT p.work_id,
            CAST(COUNT(DISTINCT CASE WHEN p.updated_at >= $2 THEN p.user_id END) AS INTEGER) AS readers7,
            CAST(COUNT(DISTINCT CASE WHEN p.updated_at >= $3 THEN p.user_id END) AS INTEGER) AS readers30
       FROM reading_progress p
       JOIN works w ON w.id = p.work_id
      WHERE w.author_id = $1
      GROUP BY p.work_id`, [authorId, cut(7), cut(30)]
  );

  const progress = await query<{ work_id: number; furthest: number | null; avg_percent: number }>(
    `SELECT p.work_id, MAX(c.number) AS furthest, AVG(p.percent) AS avg_percent
       FROM reading_progress p
       JOIN chapters c ON c.id = p.chapter_id
       JOIN works w ON w.id = p.work_id
      WHERE w.author_id = $1
      GROUP BY p.work_id`, [authorId]
  );

  const marks = await query<{ work_id: number; n: number }>(
    `SELECT c.work_id, CAST(COUNT(*) AS INTEGER) AS n
       FROM bookmarks b JOIN chapters c ON c.id = b.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE w.author_id = $1
      GROUP BY c.work_id`, [authorId]
  );

  const subs = await query<{ work_id: number; n: number }>(
    `SELECT p.work_id, CAST(COUNT(DISTINCT p.user_id) AS INTEGER) AS n
       FROM reading_progress p
       JOIN subscriptions s ON s.user_id = p.user_id AND s.status = 'active'
       JOIN works w ON w.id = p.work_id
      WHERE w.author_id = $1
      GROUP BY p.work_id`, [authorId]
  );

  const buys = await query<{ work_id: number; n: number; sum: number }>(
    `SELECT pur.work_id, CAST(COUNT(*) AS INTEGER) AS n, CAST(COALESCE(SUM(pur.amount_cents),0) AS INTEGER) AS sum
       FROM purchases pur JOIN works w ON w.id = pur.work_id
      WHERE w.author_id = $1 AND pur.status = 'paid'
      GROUP BY pur.work_id`, [authorId]
  );

  const byWork = <T extends { work_id: number }>(rows: T[]) => {
    const map = new Map<number, T>();
    for (const r of rows) map.set(r.work_id, r);
    return map;
  };
  const activeMap = byWork(active);
  const progressMap = byWork(progress);
  const marksMap = byWork(marks);
  const subsMap = byWork(subs);
  const buysMap = byWork(buys);

  const out: WorkStats[] = works.map((w) => {
    const rows = readers.filter((r) => r.work_id === w.id);
    const gender: GenderSplit = { m: 0, f: 0, other: 0, unknown: 0 };
    const age: Record<string, number> = Object.fromEntries(AGE_BUCKETS.map((b) => [b, 0]));
    const region: Record<string, number> = {};

    for (const r of rows) {
      if (r.gender === 'm') gender.m += 1;
      else if (r.gender === 'f') gender.f += 1;
      else if (r.gender === 'other') gender.other += 1;
      else gender.unknown += 1;

      const bucket = ageBucket(r.birth_date, now);
      age[bucket] = (age[bucket] || 0) + 1;

      const key = r.region || r.locale || 'не указан';
      region[key] = (region[key] || 0) + 1;
    }

    // Приватность: при большой аудитории мелкие возрастные группы схлопываем,
    // иначе по статистике можно опознать конкретного читателя (§3 мастер-промпта).
    // Для маленькой аудитории маскировка бессмысленна и только мешает автору:
    // он и так знает своих первых читателей.
    const unknownKey = 'не указан';
    const PRIVACY_MIN_COHORT = 20;
    let ageMasked: Record<string, number> = age;
    if (rows.length >= PRIVACY_MIN_COHORT) {
      const rest = Object.fromEntries(Object.entries(age).filter(([k]) => k !== unknownKey));
      const masked = maskSmallBuckets(rest);
      ageMasked = { ...masked.visible, [unknownKey]: age[unknownKey] || 0 };
    }

    const prog = progressMap.get(w.id);
    return {
      id: w.id,
      slug: w.slug,
      title: w.title,
      readers: rows.length,
      readers7: activeMap.get(w.id)?.readers7 ?? 0,
      readers30: activeMap.get(w.id)?.readers30 ?? 0,
      gender,
      age: ageMasked,
      region,
      furthestChapter: prog?.furthest ?? null,
      avgPercent: Math.round(Number(prog?.avg_percent ?? 0)),
      bookmarks: marksMap.get(w.id)?.n ?? 0,
      subscribers: subsMap.get(w.id)?.n ?? 0,
      purchases: buysMap.get(w.id)?.n ?? 0,
      purchasesSum: buysMap.get(w.id)?.sum ?? 0,
    };
  });

  return {
    works: out,
    totals: {
      readers: out.reduce((a, w) => a + w.readers, 0),
      bookmarks: out.reduce((a, w) => a + w.bookmarks, 0),
      subscribers: out.reduce((a, w) => a + w.subscribers, 0),
      purchases: out.reduce((a, w) => a + w.purchases, 0),
      purchasesSum: out.reduce((a, w) => a + w.purchasesSum, 0),
    },
  };
}
