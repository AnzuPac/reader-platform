import { beforeAll, describe, expect, it } from 'vitest';
import { initSchema, one, query } from '../lib/db';

/** Правка уже опубликованной главы не должна снимать её с публикации. */
describe('редактирование опубликованной главы', () => {
  let workId = 0;
  let chapterId = 0;

  beforeAll(async () => {
    await initSchema();
    const u = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`edit-${Date.now()}@test`, 'Autor Test']
    );
    const w = await query<{ id: number }>(
      "INSERT INTO works (slug, author_id, original_language, status, title, description) VALUES ($1,$2,'sr','published',$3,'') RETURNING id",
      [`edit-work-${Date.now()}`, u[0].id, 'Test delo']
    );
    workId = w[0].id;
    const c = await query<{ id: number }>(
      "INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,1,'Prva','stari tekst',2,'free','published') RETURNING id",
      [workId]
    );
    chapterId = c[0].id;
  });

  it('upsert сохраняет статус published', async () => {
    await query(
      `INSERT INTO chapters (work_id, number, title, content, word_count, access, status)
       VALUES ($1,1,'Novi naslov','novi tekst',2,'free','draft')
       ON CONFLICT (work_id, number) DO UPDATE SET title = EXCLUDED.title,
         content = EXCLUDED.content, word_count = EXCLUDED.word_count, access = EXCLUDED.access`,
      [workId]
    );
    const row = await one<{ status: string; content: string; title: string }>(
      'SELECT status, content, title FROM chapters WHERE id = $1', [chapterId]
    );
    expect(row?.status).toBe('published');
    expect(row?.content).toBe('novi tekst');
    expect(row?.title).toBe('Novi naslov');
  });
});
