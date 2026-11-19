/**
 * Офлайн-главы и подготовка текста для TTS.
 *
 * Хранилище — localStorage: главы небольшие (текст), а IndexedDB ради этого
 * тащить не нужно. Лимит на главу и на всё хранилище задан явно, чтобы
 * «скачал всё» не выбило квоту браузера и не сломало читалку.
 */

export const OFFLINE_KEY_PREFIX = 'rd_offline_v1_';
export const OFFLINE_INDEX_KEY = 'rd_offline_index_v1';
/** ~1 МБ на главу и ~8 МБ на всё: с запасом под 5 МБ квоты localStorage. */
export const MAX_CHAPTER_BYTES = 900_000;
export const MAX_TOTAL_BYTES = 8_000_000;

export type OfflineChapter = {
  chapterId: number;
  workId: number;
  workTitle: string;
  workSlug: string;
  number: number;
  title: string;
  html: string;
  savedAt: string;
  bytes: number;
};

export type OfflineIndexItem = {
  chapterId: number;
  workId: number;
  workTitle: string;
  workSlug: string;
  number: number;
  title: string;
  savedAt: string;
  bytes: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function chapterKey(chapterId: number): string {
  return `${OFFLINE_KEY_PREFIX}${chapterId}`;
}

function byteLength(s: string): number {
  // В браузере TextEncoder есть; в тестах он тоже доступен (node >= 11).
  return new TextEncoder().encode(s).length;
}

export function readIndex(store: StorageLike): OfflineIndexItem[] {
  try {
    const raw = store.getItem(OFFLINE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is OfflineIndexItem =>
      !!x && typeof x.chapterId === 'number' && typeof x.title === 'string');
  } catch {
    return [];
  }
}

function writeIndex(store: StorageLike, items: OfflineIndexItem[]): void {
  store.setItem(OFFLINE_INDEX_KEY, JSON.stringify(items));
}

export type SaveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: 'too_large' | 'quota' };

/** Сохранить главу. Перезапись той же главы обновляет запись, а не дублирует. */
export function saveChapter(store: StorageLike, ch: Omit<OfflineChapter, 'savedAt' | 'bytes'>): SaveResult {
  const bytes = byteLength(ch.html);
  if (bytes > MAX_CHAPTER_BYTES) return { ok: false, reason: 'too_large' };

  const index = readIndex(store);
  const others = index.filter((i) => i.chapterId !== ch.chapterId);
  const total = others.reduce((sum, i) => sum + (i.bytes || 0), 0) + bytes;
  if (total > MAX_TOTAL_BYTES) return { ok: false, reason: 'quota' };

  const record: OfflineChapter = { ...ch, savedAt: new Date().toISOString(), bytes };
  try {
    store.setItem(chapterKey(ch.chapterId), JSON.stringify(record));
  } catch {
    return { ok: false, reason: 'quota' };
  }

  writeIndex(store, [
    {
      chapterId: record.chapterId,
      workId: record.workId,
      workTitle: record.workTitle,
      workSlug: record.workSlug,
      number: record.number,
      title: record.title,
      savedAt: record.savedAt,
      bytes: record.bytes,
    },
    ...others,
  ]);
  return { ok: true, bytes };
}

export function loadChapter(store: StorageLike, chapterId: number): OfflineChapter | null {
  try {
    const raw = store.getItem(chapterKey(chapterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineChapter;
    if (!parsed || typeof parsed.html !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function removeChapter(store: StorageLike, chapterId: number): void {
  store.removeItem(chapterKey(chapterId));
  writeIndex(store, readIndex(store).filter((i) => i.chapterId !== chapterId));
}

export function totalBytes(items: OfflineIndexItem[]): number {
  return items.reduce((sum, i) => sum + (i.bytes || 0), 0);
}

/**
 * Нарезка текста для Web Speech API: длинные куски некоторые движки
 * обрывают или произносят с паузами, поэтому режем по предложениям
 * с потолком в maxChars.
 */
export function splitForSpeech(text: string, maxChars = 240): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (sentence.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      // Очень длинное предложение режем по словам.
      let part = '';
      for (const word of sentence.split(' ')) {
        if ((part + ' ' + word).trim().length > maxChars) {
          if (part) chunks.push(part.trim());
          part = word;
        } else {
          part = part ? `${part} ${word}` : word;
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    if ((current + ' ' + sentence).trim().length > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
