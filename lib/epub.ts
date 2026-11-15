// Минимальный разбор EPUB без внешних зависимостей:
// ZIP (stored/deflate) → META-INF/container.xml → OPF (manifest/spine) → XHTML-главы.
import { inflateRawSync } from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export type EpubEntry = { name: string; data: Buffer };

/** Читает ZIP-архив в память. Бросает Error('not_zip' | 'bad_zip') при проблемах структуры. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('not_zip');
  const files = new Map<string, Buffer>();

  // Ищем End of Central Directory с конца (комментарий до 65 535 байт).
  let eocd = -1;
  const from = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= from; i -= 1) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('bad_zip');

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let p = cdOffset;

  for (let i = 0; i < count; i += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) throw new Error('bad_zip');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    if (localOffset + 30 <= buf.length && buf.readUInt32LE(localOffset) === SIG_LOCAL) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = buf.slice(dataStart, dataStart + compSize);
      try {
        files.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
      } catch {
        files.set(name, Buffer.alloc(0));
      }
    }
    p += 46 + nameLen + extraLen + commentLen;
  }

  if (files.size === 0) throw new Error('bad_zip');
  return files;
}

export type EpubChapter = { title: string; html: string; href: string };

export type ParsedEpub = {
  title: string;
  language: string;
  chapters: EpubChapter[];
  warnings: string[];
};

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function resolveHref(base: string, href: string): string {
  const clean = href.replace(/^\.\//, '');
  if (clean.startsWith('/')) return clean.slice(1);
  return base ? `${base}/${clean}` : clean;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Достаёт тело XHTML и превращает разметку в безопасное подмножество. */
function bodyToHtml(xhtml: string): string {
  const body = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = body ? body[1] : xhtml;
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<img[^>]*>/gi, '');
  return html.trim();
}

/** Заголовок главы: <title> или первый h1/h2, иначе «Glava N». */
function chapterTitle(xhtml: string, n: number): string {
  const t = xhtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && stripTags(t[1])) return stripTags(t[1]);
  const h = xhtml.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  if (h && stripTags(h[1])) return stripTags(h[1]);
  return `Glava ${n}`;
}

/** Разбирает EPUB: container.xml → OPF → spine → главы по порядку. */
export function parseEpub(buf: Buffer): ParsedEpub {
  const zip = readZip(buf);
  const warnings: string[] = [];

  const container = zip.get('META-INF/container.xml');
  if (!container) throw new Error('no_container');
  const rootMatch = container.toString('utf8').match(/full-path="([^"]+)"/i);
  if (!rootMatch) throw new Error('no_rootfile');
  const opfPath = rootMatch[1];

  const opf = zip.get(opfPath);
  if (!opf) throw new Error('no_opf');
  const opfText = opf.toString('utf8');
  const opfDir = dirname(opfPath);

  const metaTitle = opfText.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const metaLang = opfText.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);

  const manifest = new Map<string, string>();
  for (const m of opfText.matchAll(/<item\b[^>]*>/gi)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/i)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
    if (id && href) manifest.set(id, href);
  }

  const spineRefs = [...opfText.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/gi)].map((m) => m[1]);
  const chapters: EpubChapter[] = [];

  spineRefs.forEach((idref, i) => {
    const href = manifest.get(idref);
    if (!href) { warnings.push(`spine: нет item «${idref}» в manifest`); return; }
    const full = resolveHref(opfDir, href).replace(/#.*$/, '');
    const file = zip.get(full);
    if (!file) { warnings.push(`нет файла главы: ${full}`); return; }
    const xhtml = file.toString('utf8');
    const html = bodyToHtml(xhtml);
    if (!html) { warnings.push(`пустая глава: ${full}`); return; }
    chapters.push({ title: chapterTitle(xhtml, i + 1), html, href: full });
  });

  if (chapters.length === 0) throw new Error('no_chapters');

  return {
    title: metaTitle ? stripTags(metaTitle[1]) : 'Bez naslova',
    language: metaLang ? stripTags(metaLang[1]).slice(0, 5) : 'sr',
    chapters,
    warnings,
  };
}
