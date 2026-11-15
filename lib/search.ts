import { query, one } from './db';
import { normalizeSr } from './translit';

/**
 * Поиск по каталогу (ТЗ 4.4, P8).
 *
 * Ключ поиска — нормализованная строка «название + автор + теги»:
 * «Андрић», «Andrić» и «Andric» дают один и тот же ключ, поэтому все три
 * запроса находят одно произведение. Ключ хранится в works.search_norm и
 * пересчитывается при записи; для старых строк есть backfill.
 */

/** Разрешена ли транслитерация ćirilica ↔ latinica (ТЗ 4.6). NULL = по умолчанию. */
export const TRANSLIT_ALLOWED_SQL =
  'COALESCE(w.translit_allowed, CASE WHEN w.publisher_id IS NULL THEN 1 ELSE 0 END)';

/** Включены ли комментарии к абзацам: самиздат и фанфики — да, издательские и классика — нет. */
export const PARAGRAPH_COMMENTS_SQL =
  "COALESCE(w.paragraph_comments_enabled, CASE WHEN w.publisher_id IS NULL AND (w.kind = 'fanfic' OR w.is_classic = 0) THEN 1 ELSE 0 END)";

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
  const w = await one<{ title: string; author_name: string }>(
    `SELECT w.title, u.display_name AS author_name
       FROM works w JOIN users u ON u.id = w.author_id WHERE w.id = $1`, [workId]
  );
  if (!w) return;
  const tags = await query<{ name: string }>(
    'SELECT t.name FROM work_tags wt JOIN tags t ON t.id = wt.tag_id WHERE wt.work_id = $1', [workId]
  );
  await query('UPDATE works SET search_norm = $2 WHERE id = $1',
    [workId, composeSearchNorm(w.title, w.author_name, tags.map((t) => t.name))]);
}

/** Дозаполняет ключ поиска (старые БД, сиды, прямые INSERT в тестах). */
export async function backfillSearchNorm(limit = 200): Promise<number> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM works WHERE search_norm IS NULL OR search_norm = '' LIMIT ${Math.max(1, Math.trunc(limit))}`
  );
  for (const r of rows) await refreshWorkSearchNorm(r.id);
  return rows.length;
}
