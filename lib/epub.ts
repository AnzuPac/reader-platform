import DOMPurify from 'isomorphic-dompurify';
import { listEntries, readEntry, naturalCompare, type ZipEntry } from './zip';

export type EpubChapter = { title: string; html: string };
export type ParsedEpub = { title: string; language: string; chapters: EpubChapter[]; warnings: string[] };

const XHTML = /\.x?html?$/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : null;
}

function resolve(base: string, href: string): string {
  const clean = href.split('#')[0];
  if (clean.startsWith('/')) return clean.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const part of clean.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'em', 'strong', 'i', 'b', 'u', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'hr', 'div', 'span', 'section', 'sup', 'sub'],
    ALLOWED_ATTR: ['id', 'class'],
  });
}

/** Все файлы архива в памяти (в пределах лимитов lib/zip). */
export function readZip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of listEntries(buf)) files.set(entry.name, readEntry(buf, entry));
  return files;
}

/** EPUB: container.xml → OPF → spine. Картинки не публикуются отдельными URL. */
export function parseEpub(buf: Buffer): ParsedEpub {
  const warnings: string[] = [];
  const zip = readZip(buf);

  const container = zip.get('META-INF/container.xml');
  if (!container) throw new Error('no_container: META-INF/container.xml отсутствует');
  const containerXml = container.toString('utf8');
  const rootMatch = /<rootfile[^>]*full-path\s*=\s*("([^"]*)"|'([^']*)')/i.exec(containerXml);
  const opfPath = decodeEntities(rootMatch?.[2] ?? rootMatch?.[3] ?? '');
  if (!opfPath) throw new Error('no_opf: rootfile не указан');
  const opfBuf = zip.get(opfPath);
  if (!opfBuf) throw new Error('no_opf: файл OPF не найден');
  const opf = opfBuf.toString('utf8');

  const titleMatch = /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf);
  const title = decodeEntities((titleMatch?.[1] || 'EPUB').trim()).slice(0, 300);
  const langMatch = /<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i.exec(opf);
  const language = decodeEntities((langMatch?.[1] || '').trim()).slice(0, 20);

  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tag = m[0];
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) manifest.set(id, resolve(opfPath, href));
  }

  const spine: string[] = [];
  for (const m of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const idref = attr(m[0], 'idref');
    if (idref && manifest.has(idref)) spine.push(manifest.get(idref)!);
  }

  const chapters: EpubChapter[] = [];
  for (const href of spine) {
    if (!XHTML.test(href)) continue;
    const entry = zip.get(href);
    if (!entry) { warnings.push(`missing ${href}`); continue; }
    const raw = entry.toString('utf8');
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(raw)?.[1] ?? raw;
    const html = sanitize(body);
    if (!html.trim()) { warnings.push(`empty ${href}`); continue; }
    const docTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1];
    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const chapterTitle = decodeEntities((docTitle || heading || `§${chapters.length + 1}`).trim()).slice(0, 160);
    chapters.push({ title: chapterTitle, html });
  }

  return { title, language, chapters, warnings };
}

/** CBZ: изображения страниц в естественном порядке. */
export function listComicPages(buf: Buffer): ZipEntry[] {
  return listEntries(buf)
    .filter((entry) => /\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
}
