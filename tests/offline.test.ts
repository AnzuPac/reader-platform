import { describe, it, expect, beforeEach } from 'vitest';
import {
  splitForSpeech, saveChapter, loadChapter, readIndex, removeChapter, totalBytes,
  MAX_CHAPTER_BYTES, chapterKey, OFFLINE_INDEX_KEY,
} from '../lib/offline';

/** Минимальная замена localStorage: тот же интерфейс, память вместо диска. */
function memStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    size: () => map.size,
  };
}

describe('нарезка текста для озвучки', () => {
  it('режет по предложениям и не превышает лимит', () => {
    const text = 'Prva rečenica. Druga rečenica je malo duža! Treća? Četvrta.';
    const chunks = splitForSpeech(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
    expect(chunks.join(' ')).toContain('Prva rečenica.');
  });

  it('очень длинное предложение режет по словам', () => {
    const long = Array.from({ length: 60 }, (_, i) => `reč${i}`).join(' ');
    const chunks = splitForSpeech(long, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
  });

  it('пустой текст даёт пустой список', () => {
    expect(splitForSpeech('   \n  ')).toEqual([]);
  });
});

describe('офлайн-хранилище глав', () => {
  let store: ReturnType<typeof memStore>;

  beforeEach(() => { store = memStore(); });

  const chapter = (id: number, html = '<p>tekst</p>') => ({
    chapterId: id, workId: 7, workTitle: 'Knjiga', workSlug: 'knjiga',
    number: id, title: `Glava ${id}`, html,
  });

  it('сохраняет и читает главу', () => {
    const res = saveChapter(store, chapter(1));
    expect(res.ok).toBe(true);
    const loaded = loadChapter(store, 1);
    expect(loaded?.html).toBe('<p>tekst</p>');
    expect(loaded?.workTitle).toBe('Knjiga');
    expect(store.getItem(chapterKey(1))).toBeTruthy();
  });

  it('индекс не дублирует одну и ту же главу', () => {
    saveChapter(store, chapter(1));
    saveChapter(store, chapter(1, '<p>новый текст</p>'));
    const index = readIndex(store);
    expect(index.filter((i) => i.chapterId === 1)).toHaveLength(1);
    expect(loadChapter(store, 1)?.html).toBe('<p>новый текст</p>');
  });

  it('удаление убирает и запись, и индекс', () => {
    saveChapter(store, chapter(1));
    removeChapter(store, 1);
    expect(loadChapter(store, 1)).toBeNull();
    expect(readIndex(store)).toHaveLength(0);
  });

  it('слишком большая глава не сохраняется', () => {
    const huge = 'x'.repeat(MAX_CHAPTER_BYTES + 10);
    const res = saveChapter(store, chapter(2, huge));
    expect(res).toEqual({ ok: false, reason: 'too_large' });
    expect(loadChapter(store, 2)).toBeNull();
  });

  it('битый индекс не ломает чтение', () => {
    store.setItem(OFFLINE_INDEX_KEY, 'не json');
    expect(readIndex(store)).toEqual([]);
  });

  it('totalBytes суммирует размеры', () => {
    saveChapter(store, chapter(1));
    saveChapter(store, chapter(2));
    expect(totalBytes(readIndex(store))).toBeGreaterThan(0);
  });
});
