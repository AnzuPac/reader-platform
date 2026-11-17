import { beforeAll, describe, expect, it } from 'vitest';
import { initSchema, query } from '../lib/db';
import { listAuthorEdits, listPendingEdits, reviewChapterEdit, submitChapterEdit } from '../lib/chapter-edits';

describe('заявки на правку опубликованных глав', () => {
  let authorId = 0;
  let otherId = 0;
  let slug = '';
  let draftSlug = '';

  beforeAll(async () => {
    await initSchema();
    const a = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`ed-it-${Date.now()}@test`, 'Autor Edits']
    );
    authorId = a[0].id;
    const o = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`ed-other-${Date.now()}@test`, 'Drugi Autor']
    );
    otherId = o[0].id;

    slug = `ed-work-${Date.now()}`;
    const w = await query<{ id: number }>(
      "INSERT INTO works (slug, author_id, original_language, status, title, description) VALUES ($1,$2,'sr','published','Delo','') RETURNING id",
      [slug, authorId]
    );
    await query(
      "INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,1,'Stara','stari tekst',2,'free','published')",
      [w[0].id]
    );

    draftSlug = `ed-draft-${Date.now()}`;
    const d = await query<{ id: number }>(
      "INSERT INTO works (slug, author_id, original_language, status, title, description) VALUES ($1,$2,'sr','draft','Nacrt','') RETURNING id",
      [draftSlug, authorId]
    );
    await query(
      "INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,1,'Nacrt','x',1,'free','draft')",
      [d[0].id]
    );
  });

  it('публикуемая глава принимается как заявка', async () => {
    const r = await submitChapterEdit({ workSlug: slug, number: 1, authorId, title: 'Novo', content: '<p>novi tekst</p>', wordCount: 2 });
    expect(r.ok).toBe(true);
    const pending = await listPendingEdits();
    expect(pending.some((p) => p.work_slug === slug)).toBe(true);
  });

  it('черновик не требует заявки', async () => {
    const r = await submitChapterEdit({ workSlug: draftSlug, number: 1, authorId, title: 'x', content: 'y', wordCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_published');
  });

  it('чужое произведение не принимается', async () => {
    const r = await submitChapterEdit({ workSlug: slug, number: 1, authorId: otherId, title: 'x', content: 'y', wordCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_found');
  });

  it('одобрение применяет текст и не снимает с публикации', async () => {
    const pending = (await listPendingEdits()).find((p) => p.work_slug === slug)!;
    const r = await reviewChapterEdit({ id: pending.id, approve: true, reviewerId: authorId });
    expect(r.ok).toBe(true);
    const ch = await query<{ status: string; content: string; title: string }>(
      'SELECT c.status, c.content, c.title FROM chapters c JOIN works w ON w.id = c.work_id WHERE w.slug = $1 AND c.number = 1', [slug]
    );
    expect(ch[0].status).toBe('published');
    expect(ch[0].content).toContain('novi tekst');
    expect(ch[0].title).toBe('Novo');
  });

  it('отклонение оставляет текст прежним', async () => {
    const sub = await submitChapterEdit({ workSlug: slug, number: 1, authorId, title: 'Odbijeno', content: '<p>ne treba</p>', wordCount: 2 });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    const r = await reviewChapterEdit({ id: sub.id, approve: false, reviewerId: authorId, comment: 'ne odgovara' });
    expect(r.ok).toBe(true);
    const ch = await query<{ content: string }>(
      'SELECT c.content FROM chapters c JOIN works w ON w.id = c.work_id WHERE w.slug = $1 AND c.number = 1', [slug]
    );
    expect(ch[0].content).not.toContain('ne treba');
    const mine = await listAuthorEdits(authorId);
    expect(mine.some((m) => m.status === 'rejected')).toBe(true);
  });

  it('повторная заявка снимает предыдущую ожидающую', async () => {
    const first = await submitChapterEdit({ workSlug: slug, number: 1, authorId, title: 'A', content: '<p>a</p>', wordCount: 1 });
    expect(first.ok).toBe(true);
    const second = await submitChapterEdit({ workSlug: slug, number: 1, authorId, title: 'B', content: '<p>b</p>', wordCount: 1 });
    expect(second.ok).toBe(true);
    const pending = (await listPendingEdits()).filter((p) => p.work_slug === slug);
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe('B');
  });
});
