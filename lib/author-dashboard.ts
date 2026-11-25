import { one, query } from './db';

export type AuthorWorkRow = {
  id: number; slug: string; title: string; status: string;
  words_total: number | string; updated_at: string | null;
  chapters: number | string; published: number | string; scheduled: number | string;
};

export type AuthorDashboard = {
  works: AuthorWorkRow[];
  totals: { works: number; chapters: number; published: number; scheduled: number; words: number; pendingEdits: number };
};

export async function authorDashboard(userId: number): Promise<AuthorDashboard> {
  const works = await query<AuthorWorkRow>(
    `SELECT w.id, w.slug, w.title, w.status, w.words_total, w.updated_at,
            (SELECT COUNT(*) FROM chapters c WHERE c.work_id = w.id) AS chapters,
            (SELECT COUNT(*) FROM chapters c WHERE c.work_id = w.id AND c.status = 'published') AS published,
            (SELECT COUNT(*) FROM chapters c WHERE c.work_id = w.id AND c.status = 'draft' AND c.publish_at IS NOT NULL) AS scheduled
       FROM works w
      WHERE w.author_id = $1
      ORDER BY w.updated_at DESC NULLS LAST, w.id DESC`,
    [userId],
  ).catch(() => [] as AuthorWorkRow[]);

  const pending = await one<{ n: number | string }>(
    `SELECT COUNT(*) AS n
       FROM chapter_edit_requests r
       JOIN chapters c ON c.id = r.chapter_id
       JOIN works w ON w.id = c.work_id
      WHERE w.author_id = $1 AND r.status = 'pending'`,
    [userId],
  ).catch(() => null);

  const totals = works.reduce(
    (acc, w) => {
      acc.chapters += Number(w.chapters) || 0;
      acc.published += Number(w.published) || 0;
      acc.scheduled += Number(w.scheduled) || 0;
      acc.words += Number(w.words_total) || 0;
      return acc;
    },
    { works: works.length, chapters: 0, published: 0, scheduled: 0, words: 0, pendingEdits: Number(pending?.n) || 0 },
  );

  return { works, totals };
}
