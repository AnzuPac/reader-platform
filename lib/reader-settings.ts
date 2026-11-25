import { one, query } from './db';

export type ReaderPrefs = {
  font_size: number; line_height: number; theme: string;
  font_family: string | null; content_width: number; version: number; updated_at: string;
};

export const DEFAULT_PREFS: ReaderPrefs = {
  font_size: 18, line_height: 1.9, theme: 'dark',
  font_family: "Georgia, 'Times New Roman', serif", content_width: 720,
  version: 1, updated_at: new Date(0).toISOString(),
};

export async function getReaderSettings(userId: number): Promise<ReaderPrefs | null> {
  return one<ReaderPrefs>(
    `SELECT font_size, line_height, theme, font_family, content_width, version, updated_at
       FROM reading_settings WHERE user_id = $1`, [userId],
  );
}

export async function saveReaderSettings(userId: number, input: Partial<ReaderPrefs>): Promise<ReaderPrefs> {
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const prefs = {
    font_size: clamp(input.font_size, 12, 48, DEFAULT_PREFS.font_size),
    line_height: clamp(input.line_height, 1.2, 3, DEFAULT_PREFS.line_height),
    theme: ['light', 'dark', 'sepia'].includes(String(input.theme)) ? String(input.theme) : DEFAULT_PREFS.theme,
    font_family: typeof input.font_family === 'string' ? input.font_family.slice(0, 120) : DEFAULT_PREFS.font_family,
    content_width: clamp(input.content_width, 320, 1400, DEFAULT_PREFS.content_width),
  };
  const now = new Date().toISOString();
  const rows = await query<ReaderPrefs>(
    `INSERT INTO reading_settings (user_id, font_size, line_height, theme, font_family, content_width, version, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       font_size = excluded.font_size, line_height = excluded.line_height, theme = excluded.theme,
       font_family = excluded.font_family, content_width = excluded.content_width,
       version = reading_settings.version + 1, updated_at = excluded.updated_at
     RETURNING font_size, line_height, theme, font_family, content_width, version, updated_at`,
    [userId, prefs.font_size, prefs.line_height, prefs.theme, prefs.font_family, prefs.content_width, now],
  );
  return rows[0];
}
