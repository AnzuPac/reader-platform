import { inflateRawSync } from 'node:zlib';

/** Минимальный ZIP-ридер: центральный каталог + извлечение записей.
 *  ZIP64 не поддерживается; архивы не распаковываются целиком — только
 *  запрошенная запись, с жёсткими лимитами. */
export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
};

const MAX_ENTRIES = 5000;
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

export function listEntries(buf: Buffer): ZipEntry[] {
  const EOCD = 0x06054b50;
  let eocd = -1;
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip_invalid');
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entries === 0xffff || cdOffset === 0xffffffff) throw new Error('zip64_unsupported');
  if (entries > MAX_ENTRIES) throw new Error('zip_too_many_entries');
  if (cdOffset + cdSize > buf.length) throw new Error('zip_invalid');

  const out: ZipEntry[] = [];
  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip_invalid');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (name.startsWith('/') || name.startsWith('\\') || name.split(/[\\/]/).includes('..')) {
      throw new Error('zip_path_traversal');
    }
    if (size > MAX_ENTRY_BYTES) throw new Error('zip_entry_too_large');
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error('zip_bomb_suspected');
    out.push({ name, method, compressedSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export function readEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const p = entry.localOffset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw new Error('zip_invalid');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const dataStart = p + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) {
    const inflated = inflateRawSync(data);
    if (inflated.length > MAX_ENTRY_BYTES) throw new Error('zip_entry_too_large');
    return inflated;
  }
  throw new Error('zip_method_unsupported');
}

export function readEntryByName(buf: Buffer, name: string): Buffer | null {
  const entry = listEntries(buf).find((item) => item.name === name);
  return entry ? readEntry(buf, entry) : null;
}

/** Естественная сортировка: page2 < page10. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
