import { query, one } from './db';
import { normalizeSr } from './translit';

/**
 * Pretraga по каталогу (ТЗ 4.4, P8).
 *
 * Ключ поиска — нормализованная строка «название + автор + теги»:
 * «Андрић», «Andrić» и «Andric» дают один и тот же ключ, поэтому все три
 * запроса находят одно произведение. Ключ хранится в works.search_norm и
 * пересчитывается при записи; для старых строк есть backfill.
 */

/**
 * Выражения написаны в булевом виде, без CASE … THEN 1 ELSE 0: колонки
 * translit_allowed/paragraph_comments_enabled — BOOLEAN в PostgreSQL и INTEGER
 * в SQLite, а COALESCE(boolean, integer) и `is_classic = 0` в PostgreSQL падают
 * («operator does not exist: boolean = integer»). `NOT x` и `IS NULL` работают
 * в обоих диалектах, как и `flag()` при чтении результата.
 */

/** Разрешена ли транслитерация ćirilica ↔ latinica (ТЗ 4.6). NULL = по умолчанию. */
export const TRANSLIT_ALLOWED_SQL =
  'COALESCE(w.translit_allowed, (w.publisher_id IS NULL))';

/** Включены ли комментарии к абзацам: самиздат и фанфики — да, издательские и классика — нет. */
export const PARAGRAPH_COMMENTS_SQL =
  "COALESCE(w.paragraph_comments_enabled, (w.publisher_id IS NULL AND (w.kind = 'fanfic' OR NOT w.is_classic)))";

/** Флаг из БД (0/1 или boolean) → boolean. */
export function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

export function composeSearchNorm(title: string, authorName: string, tags: string[] = []): string {
  return normalizeSr([title, authorName, ...tags].join(' '));
}

/** Токены запроса: по слову, уже нормализованные. */
export function searchTokens(q: string): string[] {
  return normalizeSr(q).split(' ').filter(Boolean).slice(0, 6);
}

export async function refreshWorkSearchNorm(workId: number): Promise<void> {
  const w = await one<{ title: string; author_name: string; fandom?: string | null; pairing?: string | null; content_warnings?: string | null }>(
    `SELECT w.title, u.display_name AS author_name, w.fandom, w.pairing, w.content_warnings
       FROM works w JOIN users u ON u.id = w.author_id WHERE w.id = $1`, [workId]
  );
  if (!w) return;
  const tags = await query<{ name: string }>(
    'SELECT t.name FROM work_tags wt JOIN tags t ON t.id = wt.tag_id WHERE wt.work_id = $1', [workId]
  );
  const genres = await query<{ name_sr: string; name_en: string; name_ru: string }>(
    `SELECT g.name_sr, g.name_en, g.name_ru
       FROM work_genres wg JOIN genres g ON g.id = wg.genre_id WHERE wg.work_id = $1`, [workId]
  );
  // Ищем и по фандому/пейрингу/предупреждениям/жанрам: раньше поиск по ним
  // не работал, хотя placeholder их обещал (review-2, P2).
  const extra = [
    w.fandom, w.pairing, w.content_warnings,
    ...genres.flatMap((g) => [g.name_sr, g.name_en, g.name_ru]),
  ].filter(Boolean) as string[];
  await query('UPDATE works SET search_norm = $2 WHERE id = $1',
    [workId, composeSearchNorm(w.title, w.author_name, [...tags.map((t) => t.name), ...extra])]);
}

/** Дозаполняет ключ поиска (старые БД, сиды, прямые INSERT в тестах). */
export async function backfillSearchNorm(limit = 200): Promise<number> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM works WHERE search_norm IS NULL OR search_norm = '' LIMIT ${Math.max(1, Math.trunc(limit))}`
  );
  for (const r of rows) await refreshWorkSearchNorm(r.id);
  return rows.length;
}
