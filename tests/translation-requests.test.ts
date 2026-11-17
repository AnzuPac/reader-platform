import { beforeAll, describe, expect, it } from 'vitest';
import { initSchema, query } from '../lib/db';
import {
  listAuthorTranslations, listTranslationQueue, requestTranslation, reviewTranslation,
} from '../lib/translation-requests';

describe('заявки на перевод: ИИ-черновик и проверка', () => {
  let authorId = 0;
  let otherId = 0;
  let chapterId = 0;
  let draftChapterId = 0;

  beforeAll(async () => {
    await initSchema();
    const a = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`tr-a-${Date.now()}@test`, 'Autor Prevod']
    );
    authorId = a[0].id;
    const o = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`tr-o-${Date.now()}@test`, 'Drugi']
    );
    otherId = o[0].id;

    const w = await query<{ id: number }>(
      "INSERT INTO works (slug, author_id, original_language, status, title, description) VALUES ($1,$2,'sr','published','Prevod delo','') RETURNING id",
      [`tr-work-${Date.now()}`, authorId]
    );
    const c = await query<{ id: number }>(
      "INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,1,'Prva','tekst',1,'free','published') RETURNING id",
      [w[0].id]
    );
    chapterId = c[0].id;
    const d = await query<{ id: number }>(
      "INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,2,'Nacrt','x',1,'free','draft') RETURNING id",
      [w[0].id]
    );
    draftChapterId = d[0].id;
  });

  it('заявка на опубликованную главу принимается', async () => {
    const r = await requestTranslation({ chapterId, targetLang: 'en', userId: authorId });
    expect(r.ok).toBe(true);
    const queue = await listTranslationQueue();
    expect(queue.some((q) => q.chapter_number === 1 && q.target_lang === 'en')).toBe(true);
  });

  it('черновик и чужое произведение не принимаются', async () => {
    const d = await requestTranslation({ chapterId: draftChapterId, targetLang: 'en', userId: authorId });
    expect(d.ok).toBe(false);
    const o = await requestTranslation({ chapterId, targetLang: 'ru', userId: otherId });
    expect(o.ok).toBe(false);
  });

  it('повторная заявка по той же главе и языку отклоняется', async () => {
    const again = await requestTranslation({ chapterId, targetLang: 'en', userId: authorId });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('duplicate');
  });

  it('одобрение публикует перевод, отклонение оставляет черновик', async () => {
    // ИИ-черновик имитируем строкой в chapter_translations: сеть к модели в тестах не нужна.
    await query(
      `INSERT INTO chapter_translations (chapter_id, lang, title, content, source_hash, status, model)
       VALUES ($1,'en','The First','translated text','hash-test','draft','test-model')`,
      [chapterId]
    );
    const q = (await listTranslationQueue()).find((x) => x.chapter_number === 1 && x.target_lang === 'en')!;

    const bad = await reviewTranslation({ id: q.id, approve: false, comment: 'ne valja' });
    expect(bad.ok).toBe(true);
    const after = await query<{ status: string }>(
      "SELECT status FROM chapter_translations WHERE chapter_id = $1 AND lang = 'en'", [chapterId]
    );
    expect(after[0].status).toBe('draft');

    const second = await requestTranslation({ chapterId, targetLang: 'en', userId: authorId });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const good = await reviewTranslation({ id: second.id, approve: true, reviewerId: authorId });
    expect(good.ok).toBe(true);
    const approved = await query<{ status: string }>(
      "SELECT status FROM chapter_translations WHERE chapter_id = $1 AND lang = 'en'", [chapterId]
    );
    expect(approved[0].status).toBe('approved');
  });

  it('автор видит свои заявки', async () => {
    const mine = await listAuthorTranslations(authorId);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((m) => m.status === 'rejected')).toBe(true);
    expect(mine.some((m) => m.status === 'approved')).toBe(true);
  });
});
