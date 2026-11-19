import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>, one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>, pc: any;

/**
 * Комментарии к абзацам (ТЗ 4.6, 5.4).
 * Проверяем правило доступа (самиздат и фанфики — да, издательские и классика —
 * нет), валидацию ввода, скрытие и подсчёт видимых комментариев.
 */

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-pc-'));
  const db = await import('../lib/db');
  query = db.query;
  one = db.one as typeof one;
  await db.initSchema();
  pc = await import('../lib/paragraph-comments');
});

async function makeUser(email: string, role = 'reader'): Promise<number> {
  const rows = await query(
    'INSERT INTO users (email, display_name, role) VALUES ($1,$2,$3) RETURNING id',
    [email, email.split('@')[0], role]
  );
  return Number(rows[0].id);
}

let publisherSeq = 0;
async function makePublisher(): Promise<number> {
  publisherSeq += 1;
  const rows = await query(
    'INSERT INTO publishers (name, slug) VALUES ($1,$2) RETURNING id',
    ['Издательство', `izd-${publisherSeq}`]
  );
  return Number(rows[0].id);
}

/** Произведение + глава. Флаги по умолчанию — как в реальном INSERT. */
async function makeChapter(opts: {
  authorId: number; slug: string; kind?: string; classic?: number;
  publisherId?: number | null; enabled?: number | null;
}): Promise<{ workId: number; chapterId: number }> {
  const w = await query(
    `INSERT INTO works (slug, author_id, publisher_id, original_language, status, title, description,
                        kind, is_classic, paragraph_comments_enabled)
     VALUES ($1,$2,$3,'sr','published','Knjiga','opis',$4,$5,$6) RETURNING id`,
    [opts.slug, opts.authorId, opts.publisherId ?? null, opts.kind ?? 'original',
      opts.classic ?? 0, opts.enabled ?? null]
  );
  const workId = Number(w[0].id);
  const c = await query(
    `INSERT INTO chapters (work_id, number, title, content, status, access)
     VALUES ($1,1,'Glava 1','Tekst','published','free') RETURNING id`,
    [workId]
  );
  return { workId, chapterId: Number(c[0].id) };
}

describe('комментарии к абзацам: доступ по типу произведения', () => {
  it('самиздат (без издательства, не классика) — включено', async () => {
    const a = await makeUser('a-selfpub@test', 'author');
    const { chapterId } = await makeChapter({ authorId: a, slug: 'selfpub' });
    expect(await pc.paragraphCommentsAllowed(chapterId)).toBe(true);
  });

  it('фанфик — включено', async () => {
    const a = await makeUser('a-fanfic@test', 'author');
    const { chapterId } = await makeChapter({ authorId: a, slug: 'fanfic-1', kind: 'fanfic' });
    expect(await pc.paragraphCommentsAllowed(chapterId)).toBe(true);
  });

  it('издательская книга — выключено', async () => {
    const a = await makeUser('a-pub@test', 'author');
    const pub = await makePublisher();
    const { chapterId } = await makeChapter({ authorId: a, slug: 'publishing-1', publisherId: pub });
    expect(await pc.paragraphCommentsAllowed(chapterId)).toBe(false);
  });

  it('классика — выключено', async () => {
    const a = await makeUser('a-classic@test', 'author');
    const { chapterId } = await makeChapter({ authorId: a, slug: 'classic-1', classic: 1 });
    expect(await pc.paragraphCommentsAllowed(chapterId)).toBe(false);
  });

  it('явный флаг правообладателя перекрывает дефолт в обе стороны', async () => {
    const a = await makeUser('a-explicit@test', 'author');
    const pub = await makePublisher();
    const off = await makeChapter({ authorId: a, slug: 'fanfic-off', kind: 'fanfic', enabled: 0 });
    const on = await makeChapter({ authorId: a, slug: 'publishing-on', publisherId: pub, enabled: 1 });
    expect(await pc.paragraphCommentsAllowed(off.chapterId)).toBe(false);
    expect(await pc.paragraphCommentsAllowed(on.chapterId)).toBe(true);
  });

  it('несуществующая глава — выключено, список пуст', async () => {
    expect(await pc.paragraphCommentsAllowed(999999)).toBe(false);
    expect(await pc.listParagraphComments(999999)).toEqual([]);
  });
});

describe('комментарии к абзацам: валидация добавления', () => {
  let chapterId: number, userId: number, disabledChapterId: number;

  beforeAll(async () => {
    const a = await makeUser('a-add@test', 'author');
    const pub = await makePublisher();
    userId = await makeUser('reader-add@test');
    chapterId = (await makeChapter({ authorId: a, slug: 'add-ok' })).chapterId;
    disabledChapterId = (await makeChapter({ authorId: a, slug: 'add-off', publisherId: pub })).chapterId;
  });

  it('пустой текст отклоняется', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 0, userId, text: '   ' });
    expect(r).toEqual({ ok: false, error: 'bad_text' });
  });

  it('текст длиннее 1000 символов отклоняется', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 0, userId, text: 'я'.repeat(1001) });
    expect(r).toEqual({ ok: false, error: 'bad_text' });
  });

  it('ровно 1000 символов принимается', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 3, userId, text: 'я'.repeat(1000) });
    expect(r.ok).toBe(true);
  });

  it('индекс абзаца < 0 отклоняется', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: -1, userId, text: 'текст' });
    expect(r).toEqual({ ok: false, error: 'bad_index' });
  });

  it('индекс абзаца > 100000 отклоняется', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 100001, userId, text: 'текст' });
    expect(r).toEqual({ ok: false, error: 'bad_index' });
  });

  it('корректный комментарий сохраняется', async () => {
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 5, userId, text: '  хорошая сцена  ' });
    expect(r.ok).toBe(true);
    const list = await pc.listParagraphComments(chapterId);
    const mine = list.find((c: any) => c.id === (r as any).id)!;
    expect(mine.text).toBe('хорошая сцена');
    expect(mine.paragraph_index).toBe(5);
  });

  it('при выключенном флаге добавление запрещено', async () => {
    const r = await pc.addParagraphComment({ chapterId: disabledChapterId, paragraphIndex: 0, userId, text: 'текст' });
    expect(r).toEqual({ ok: false, error: 'disabled' });
  });
});

describe('комментарии к абзацам: список и подсчёт', () => {
  let chapterId: number, authorId: number, readerId: number, adminId: number, modId: number;
  let visibleId: number, hiddenId: number;

  beforeAll(async () => {
    authorId = await makeUser('a-list@test', 'author');
    readerId = await makeUser('reader-list@test');
    adminId = await makeUser('admin-list@test', 'admin');
    modId = await makeUser('moderator-list@test', 'moderator');
    chapterId = (await makeChapter({ authorId, slug: 'list-1' })).chapterId;

    const v = await pc.addParagraphComment({ chapterId, paragraphIndex: 1, userId: readerId, text: 'виден' });
    const h = await pc.addParagraphComment({ chapterId, paragraphIndex: 2, userId: readerId, text: 'скрыт' });
    visibleId = v.id;
    hiddenId = h.id;

    const res = await pc.setParagraphCommentHidden({ commentId: hiddenId, hidden: true, actorId: authorId, actorRole: 'author' });
    expect(res).toEqual({ ok: true });
  });

  it('скрытый комментарий не попадает в список', async () => {
    const list = await pc.listParagraphComments(chapterId);
    expect(list.map((c: any) => c.id)).not.toContain(hiddenId);
    expect(list.map((c: any) => c.id)).toContain(visibleId);
  });

  it('includeHidden возвращает и скрытые', async () => {
    const list = await pc.listParagraphComments(chapterId, { includeHidden: true });
    expect(list.map((c: any) => c.id)).toContain(hiddenId);
    const hidden = list.find((c: any) => c.id === hiddenId)!;
    expect(Number(hidden.hidden)).toBe(1);
  });

  it('count считает только не скрытые', async () => {
    expect(await pc.countParagraphComments(chapterId)).toBe(1);
    await pc.addParagraphComment({ chapterId, paragraphIndex: 3, userId: readerId, text: 'ещё один' });
    expect(await pc.countParagraphComments(chapterId)).toBe(2);
  });

  it('автор комментария возвращается как display_name', async () => {
    const list = await pc.listParagraphComments(chapterId);
    expect(list.find((c: any) => c.id === visibleId)!.author).toBe('reader-list');
  });
});

describe('комментарии к абзацам: скрытие и права', () => {
  let chapterId: number, authorId: number, strangerId: number, adminId: number, modId: number;
  let commentId: number;

  beforeAll(async () => {
    authorId = await makeUser('a-hide@test', 'author');
    strangerId = await makeUser('stranger-hide@test');
    adminId = await makeUser('admin-hide@test', 'admin');
    modId = await makeUser('moderator-hide@test', 'moderator');
    chapterId = (await makeChapter({ authorId, slug: 'hide-1' })).chapterId;
    const r = await pc.addParagraphComment({ chapterId, paragraphIndex: 0, userId: strangerId, text: 'спорный' });
    commentId = r.id;
  });

  it('посторонний не может скрыть', async () => {
    const r = await pc.setParagraphCommentHidden({ commentId, hidden: true, actorId: strangerId, actorRole: 'author' });
    expect(r).toEqual({ ok: false, error: 'forbidden' });
  });

  it('автор произведения может скрыть и показать обратно', async () => {
    expect(await pc.setParagraphCommentHidden({ commentId, hidden: true, actorId: authorId, actorRole: 'author' }))
      .toEqual({ ok: true });
    expect(await pc.countParagraphComments(chapterId)).toBe(0);
    expect(await pc.setParagraphCommentHidden({ commentId, hidden: false, actorId: authorId, actorRole: 'author' }))
      .toEqual({ ok: true });
    expect(await pc.countParagraphComments(chapterId)).toBe(1);
  });

  it('админ может скрыть', async () => {
    const r = await pc.setParagraphCommentHidden({ commentId, hidden: true, actorId: adminId, actorRole: 'admin' });
    expect(r).toEqual({ ok: true });
    await pc.setParagraphCommentHidden({ commentId, hidden: false, actorId: adminId, actorRole: 'admin' });
  });

  it('модератор может скрыть', async () => {
    const r = await pc.setParagraphCommentHidden({ commentId, hidden: true, actorId: modId, actorRole: 'moderator' });
    expect(r).toEqual({ ok: true });
    await pc.setParagraphCommentHidden({ commentId, hidden: false, actorId: modId, actorRole: 'moderator' });
  });

  it('несуществующий комментарий — not_found', async () => {
    const r = await pc.setParagraphCommentHidden({ commentId: 999999, hidden: true, actorId: adminId, actorRole: 'admin' });
    expect(r).toEqual({ ok: false, error: 'not_found' });
  });
});
