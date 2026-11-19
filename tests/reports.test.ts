import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let rep: typeof import('../lib/reports');
let one: One;
let uid = 0;
let workId = 0;
let commentId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-reports-'));
  const db = await import('../lib/db');
  one = db.one as One;
  rep = await import('../lib/reports');
  await db.initSchema();

  uid = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('rep@test','Rep','reader') RETURNING id",
  )).id;
  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description)
     VALUES ('report-work', $1, 'sr', 'published', 'Delo', '') RETURNING id`,
    [uid],
  )).id;
  commentId = (await one<{ id: number }>(
    `INSERT INTO comments (user_id, work_id, body) VALUES ($1,$2,'спам-текст') RETURNING id`,
    [uid, workId],
  )).id;
});

describe('жалобы', () => {
  it('создаёт жалобу на произведение', async () => {
    const res = await rep.createReport(uid, { targetType: 'work', targetId: workId, reason: 'spam' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(false);
  });

  it('повторная жалоба не плодит записи', async () => {
    const res = await rep.createReport(uid, { targetType: 'work', targetId: workId, reason: 'spam' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(true);

    const rows = await one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM reports WHERE target_type = 'work' AND target_id = $1", [workId],
    );
    expect(Number(rows.n)).toBe(1);
  });

  it('неизвестный тип и причина отклоняются', async () => {
    expect(await rep.createReport(uid, { targetType: 'hacked', targetId: workId, reason: 'spam' }))
      .toEqual({ ok: false, reason: 'bad_target' });
    expect(await rep.createReport(uid, { targetType: 'work', targetId: workId, reason: 'hate' }))
      .toEqual({ ok: false, reason: 'bad_reason' });
  });

  it('несуществующий объект не принимается', async () => {
    expect(await rep.createReport(uid, { targetType: 'work', targetId: 999_999, reason: 'spam' }))
      .toEqual({ ok: false, reason: 'not_found' });
  });

  it('жалоба на комментарий скрывает его при решении', async () => {
    const created = await rep.createReport(uid, { targetType: 'comment', targetId: commentId, reason: 'abuse' });
    expect(created.ok).toBe(true);

    const res = await rep.resolveReport((created as { id: number }).id, 'moderator-1', 'hide_comment');
    expect(res.ok).toBe(true);

    const c = await one<{ status: string }>('SELECT status FROM comments WHERE id = $1', [commentId]);
    expect(c.status).toBe('hidden');
  });

  it('отклонение жалобы не трогает объект', async () => {
    const created = await rep.createReport(uid, { targetType: 'work', targetId: workId, reason: 'other' });
    const res = await rep.resolveReport((created as { id: number }).id, 'moderator-1', 'dismiss');
    expect(res.ok).toBe(true);

    const w = await one<{ status: string }>('SELECT status FROM works WHERE id = $1', [workId]);
    expect(w.status).toBe('published');

    const r = await one<{ status: string; resolved_by: string }>(
      'SELECT status, resolved_by FROM reports WHERE id = $1', [(created as { id: number }).id],
    );
    expect(r.status).toBe('dismissed');
    expect(r.resolved_by).toBe('moderator-1');
  });

  it('счётчики жалоб считаются по статусам', async () => {
    // Одна открытая жалоба на объект от одного автора: вторая попытка по тому же
    // объекту (даже с другой причиной) — дубль, поэтому всего записей две:
    // закрытая по комментарию и отклонённая по произведению.
    const counts = await rep.reportCounts();
    expect(counts.open + counts.resolved + counts.dismissed).toBe(2);
    expect(counts.resolved).toBe(1);
    expect(counts.dismissed).toBe(1);
    expect(counts.open).toBe(0);
  });
});
