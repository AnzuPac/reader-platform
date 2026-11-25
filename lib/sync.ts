import { one, query } from './db';

export type SyncProgress = {
  work_id: number; chapter_id: number | null; position: number; percent: number;
  version?: number; updated_at: string;
};
export type SyncSettings = {
  font_size: number; line_height: number; theme: string; font_family?: string | null;
  content_width: number; version?: number; updated_at: string;
};
export type SyncBookmark = {
  client_id: string; chapter_id: number; position: number; note?: string | null;
  deleted?: boolean; version?: number; updated_at: string;
};
export type SyncAnnotation = {
  client_id: string; chapter_id: number; position: number; length: number;
  note?: string | null; color?: string | null; deleted?: boolean; version?: number; updated_at: string;
};

const ts = (value: string | undefined | null): number => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function isNewer(a: { updated_at: string; version?: number }, b: { updated_at: string; version?: number }): boolean {
  const ta = ts(a.updated_at);
  const tb = ts(b.updated_at);
  if (ta !== tb) return ta > tb;
  return (a.version || 0) > (b.version || 0);
}

export type MergeResult<T> = { value: T; conflict: boolean };

/** Прогресс: побеждает более свежая позиция; расхождение глав в окне 5 минут — конфликт. */
export function mergeProgress(server: SyncProgress | null, client: SyncProgress | null): MergeResult<SyncProgress | null> {
  if (!server) return { value: client, conflict: false };
  if (!client) return { value: server, conflict: false };
  const conflict = server.chapter_id !== client.chapter_id
    && Math.abs(ts(server.updated_at) - ts(client.updated_at)) < 5 * 60_000;
  return { value: isNewer(client, server) ? client : server, conflict };
}

export function mergeSettings(server: SyncSettings | null, client: SyncSettings | null): MergeResult<SyncSettings | null> {
  if (!server) return { value: client, conflict: false };
  if (!client) return { value: server, conflict: false };
  return { value: isNewer(client, server) ? client : server, conflict: false };
}

/** Закладки/аннотации: объединение по client_id, надгробия удаления не теряются. */
export function mergeItems<T extends { client_id: string; updated_at: string; version?: number }>(
  server: T[], client: T[],
): { items: T[]; conflicts: number } {
  const map = new Map<string, T>();
  for (const item of server) map.set(item.client_id, item);
  let conflicts = 0;
  for (const item of client) {
    const existing = map.get(item.client_id);
    if (!existing) { map.set(item.client_id, item); continue; }
    if (isNewer(item, existing)) map.set(item.client_id, item);
    else conflicts += 1;
  }
  return { items: Array.from(map.values()), conflicts };
}

const iso = (value: string | undefined): string => {
  const parsed = ts(value);
  return parsed ? new Date(parsed).toISOString() : new Date().toISOString();
};

export async function applyProgress(userId: number, items: SyncProgress[]): Promise<number> {
  let conflicts = 0;
  for (const item of items.slice(0, 500)) {
    const updated = iso(item.updated_at);
    const rows = await query<{ updated_at: string }>(
      'SELECT updated_at FROM reading_progress WHERE user_id = $1 AND work_id = $2', [userId, item.work_id],
    ).catch(() => []);
    const server = rows[0];
    if (server && ts(updated) < ts(server.updated_at)) { conflicts += 1; continue; }
    await query(
      `INSERT INTO reading_progress (user_id, work_id, chapter_id, position, percent, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, work_id) DO UPDATE SET
         chapter_id = excluded.chapter_id, position = excluded.position,
         percent = excluded.percent, updated_at = excluded.updated_at`,
      [userId, item.work_id, item.chapter_id ?? null, Math.max(0, Number(item.position) || 0),
        Math.min(100, Math.max(0, Number(item.percent) || 0)), updated],
    );
  }
  return conflicts;
}

export async function applySettings(userId: number, client: SyncSettings | null): Promise<SyncSettings | null> {
  const row = await one<SyncSettings>(
    'SELECT font_size, line_height, theme, font_family, content_width, version, updated_at FROM reading_settings WHERE user_id = $1',
    [userId],
  ).catch(() => null);
  const merged = mergeSettings(row, client).value;
  if (!merged) return null;
  await query(
    `INSERT INTO reading_settings (user_id, font_size, line_height, theme, font_family, content_width, version, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
       font_size = excluded.font_size, line_height = excluded.line_height, theme = excluded.theme,
       font_family = excluded.font_family, content_width = excluded.content_width,
       version = excluded.version, updated_at = excluded.updated_at`,
    [userId, Math.max(10, Math.min(48, Number(merged.font_size) || 18)),
      Math.max(1, Math.min(3, Number(merged.line_height) || 1.8)), String(merged.theme || 'light'),
      merged.font_family || null, Math.max(320, Math.min(1400, Number(merged.content_width) || 720)),
      Math.max(1, Number(merged.version) || 1), iso(merged.updated_at)],
  );
  return merged;
}

export async function applyItems(
  table: 'sync_bookmarks' | 'reading_annotations', userId: number,
  items: Array<SyncBookmark | SyncAnnotation>,
): Promise<number> {
  let conflicts = 0;
  for (const item of items.slice(0, 500)) {
    if (!item.client_id || !item.chapter_id) continue;
    const updated = iso(item.updated_at);
    const existing = await one<{ updated_at: string | null }>(
      `SELECT updated_at FROM ${table} WHERE client_id = $1 AND user_id = $2`, [item.client_id, userId],
    ).catch(() => null);
    if (existing?.updated_at && ts(updated) < ts(existing.updated_at)) { conflicts += 1; continue; }
    if (table === 'sync_bookmarks') {
      await query(
        `INSERT INTO sync_bookmarks (user_id, chapter_id, position, note, client_id, deleted, version, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (client_id) DO UPDATE SET position = excluded.position, note = excluded.note,
           deleted = excluded.deleted, version = excluded.version, updated_at = excluded.updated_at`,
        [userId, item.chapter_id, Math.max(0, Number(item.position) || 0),
          (item as SyncBookmark).note || null, item.client_id, (item as SyncBookmark).deleted ? 1 : 0,
          Math.max(1, Number(item.version) || 1), updated],
      );
    } else {
      const annotation = item as SyncAnnotation;
      await query(
        `INSERT INTO reading_annotations (client_id, user_id, chapter_id, position, length, note, color, deleted, version, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (client_id) DO UPDATE SET position = excluded.position, length = excluded.length,
           note = excluded.note, color = excluded.color, deleted = excluded.deleted,
           version = excluded.version, updated_at = excluded.updated_at`,
        [annotation.client_id, userId, annotation.chapter_id, Math.max(0, Number(annotation.position) || 0),
          Math.max(0, Number(annotation.length) || 0), annotation.note || null, annotation.color || null,
          annotation.deleted ? 1 : 0, Math.max(1, Number(annotation.version) || 1), updated],
      );
    }
  }
  return conflicts;
}

export async function touchDevice(userId: number, deviceId: string, platform?: string) {
  if (!deviceId) return;
  await query(
    `INSERT INTO user_devices (id, user_id, platform, last_seen_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET platform = COALESCE(excluded.platform, user_devices.platform), last_seen_at = excluded.last_seen_at`,
    [deviceId, userId, platform || null, new Date().toISOString()],
  ).catch(() => {});
}

export async function logSync(userId: number, deviceId: string | undefined, entity: string, count: number) {
  await query(
    'INSERT INTO sync_operations (user_id, device_id, entity, entity_id, op, applied_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [userId, deviceId || null, entity, null, `push:${count}`, new Date().toISOString()],
  ).catch(() => {});
}
