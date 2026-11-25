import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { one, query } from './db';

/** Квоты и лимиты личных файлов (не путать с офлайн-загрузками каталога). */
export const MAX_FILE_BYTES = Number(process.env.MAX_USER_FILE_BYTES || 100 * 1024 * 1024);
export const DEFAULT_QUOTA_BYTES = Number(process.env.USER_STORAGE_DEFAULT_BYTES || 1024 * 1024 * 1024);

const ALLOWED: Record<string, string> = {
  epub: 'application/epub+zip',
  fb2: 'application/x-fictionbook+xml',
  txt: 'text/plain',
  pdf: 'application/pdf',
  cbz: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

export type FormatCheck = { ok: true; format: string; mime: string } | { ok: false; error: string };

function fail(error: string): FormatCheck { return { ok: false, error }; }

/** Минимальный разбор ZIP: центральный каталог, лимиты распаковки и path traversal.
 *  Архивы не распаковываются — только проверяются, поэтому zip-bomb не может
 *  раздуть память на этом шаге. */
export function scanZip(buf: Buffer): { ok: true } | { ok: false; error: string } {
  const EOCD = 0x06054b50;
  let eocd = -1;
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, error: 'zip_invalid' };
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entries > 5000) return { ok: false, error: 'zip_too_many_entries' };
  if (cdOffset + cdSize > buf.length) return { ok: false, error: 'zip_invalid' };

  let totalUncompressed = 0;
  let totalCompressed = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return { ok: false, error: 'zip_invalid' };
    const compressed = buf.readUInt32LE(p + 20);
    const uncompressed = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (name.startsWith('/') || name.startsWith('\\') || name.split(/[\\/]/).includes('..')) {
      return { ok: false, error: 'zip_path_traversal' };
    }
    totalUncompressed += uncompressed;
    totalCompressed += compressed;
    if (totalUncompressed > 512 * 1024 * 1024) return { ok: false, error: 'zip_bomb_suspected' };
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (totalCompressed > 0 && totalUncompressed / totalCompressed > 200) {
    return { ok: false, error: 'zip_bomb_suspected' };
  }
  return { ok: true };
}

export function detectFormat(buffer: Buffer, extRaw: string): FormatCheck {
  const ext = extRaw.toLowerCase().replace(/^\./, '');
  const mime = ALLOWED[ext];
  if (!mime) return fail('format_not_allowed');
  if (!buffer.length) return fail('empty_file');
  const head = buffer.subarray(0, 8192);

  if (ext === 'pdf') {
    return head.subarray(0, 5).toString('latin1') === '%PDF-' ? { ok: true, format: ext, mime } : fail('content_mismatch');
  }
  if (ext === 'cbr') {
    const sig = head.subarray(0, 8).toString('latin1');
    const rar = sig.startsWith('Rar!\x1a\x07\x00') || sig.startsWith('Rar!\x1a\x07\x01\x00');
    return rar ? { ok: true, format: ext, mime } : fail('content_mismatch');
  }
  if (ext === 'epub' || ext === 'cbz') {
    if (head[0] !== 0x50 || head[1] !== 0x4b) return fail('content_mismatch');
    const zip = scanZip(buffer);
    if (!zip.ok) return fail(zip.error);
    if (ext === 'epub' && !buffer.subarray(0, 256).toString('latin1').includes('application/epub+zip')) {
      return fail('not_epub');
    }
    return { ok: true, format: ext, mime };
  }
  if (ext === 'fb2') {
    const text = head.toString('utf8');
    return /<FictionBook|<fictionbook/i.test(text) ? { ok: true, format: ext, mime } : fail('content_mismatch');
  }
  // txt: бинарный мусор отклоняем, UTF-8 проверяем строго
  if (head.includes(0)) return fail('binary_txt');
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head);
  } catch {
    return fail('encoding_not_supported');
  }
  return { ok: true, format: ext, mime };
}

export function userFilesDir(): string {
  return path.join(process.env.SQLITE_DIR || path.join(process.cwd(), 'data'), 'user-files');
}

/** Возвращает относительный путь для БД; абсолютный путь никогда не храним. */
export async function saveUserFile(userId: number, buffer: Buffer, ext: string): Promise<{ rel: string; sha256: string }> {
  const dir = path.join(userFilesDir(), String(userId));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}.${ext}`;
  const abs = path.join(dir, name);
  await fs.writeFile(abs, buffer, { mode: 0o600 });
  const rel = path.relative(userFilesDir(), abs);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return { rel, sha256 };
}

export function resolveStoredFile(rel: string): string {
  const root = path.resolve(userFilesDir());
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('path_traversal');
  return abs;
}

export async function usageFor(userId: number): Promise<number> {
  const row = await one<{ bytes: number | string }>('SELECT bytes FROM user_storage_usage WHERE user_id = $1', [userId]);
  return Number(row?.bytes || 0);
}

/** Квота личных файлов берётся из активной подписки (plans.storage_bytes).
 *  При даунгрейде действует меньшая квота, но файлы не удаляются: чтение и
 *  скачивание остаются, блокируются только новые загрузки сверх лимита. */
export async function quotaFor(userId: number): Promise<number> {
  const row = await one<{ storage_bytes: number | string }>(
    `SELECT p.storage_bytes
       FROM subscriptions s JOIN plans p ON p.code = s.plan_code
      WHERE s.user_id = $1 AND s.status = 'active' AND s.current_period_end > $2
      ORDER BY p.storage_bytes DESC
      LIMIT 1`,
    [userId, new Date().toISOString()],
  ).catch(() => null);
  const value = Number(row?.storage_bytes || 0);
  return value > 0 ? value : DEFAULT_QUOTA_BYTES;
}

export async function addUsage(userId: number, delta: number): Promise<void> {
  // Отрицательная дельта (удаление) должна уменьшать счётчик, но не уводить его
  // ниже нуля. Раньше Math.max(0, delta) превращал удаление в ноль — место
  // оставалось занятым (найдено E2E 25.11).
  await query(
    `INSERT INTO user_storage_usage (user_id, bytes, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET bytes = CASE WHEN user_storage_usage.bytes + $2 < 0 THEN 0 ELSE user_storage_usage.bytes + $2 END,
           updated_at = $3`,
    [userId, Math.max(-1073741824, delta), new Date().toISOString()],
  );
}
