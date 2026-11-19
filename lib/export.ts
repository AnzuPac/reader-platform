import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

/**
 * Экспорт произведения в PDF.
 *
 * Права проверяются на сервере до генерации — по антипиратской спеке §1:
 * экспорт платного/защищённого контента запрещён, разрешён только там, где
 * правообладатель не против: собственное произведение автора, классика
 * (public domain) и административные роли. Никаких публичных ссылок на файл.
 */

export type ExportViewer = { uid: number; role: string } | null;

export type ExportableWork = {
  id: number;
  slug: string;
  title: string;
  author_id: number;
  author_name: string;
  is_classic?: number | boolean | null;
};

export type ExportDecision =
  | { allowed: true; watermark: string | null; reason: 'owner' | 'admin' | 'public_domain' }
  | { allowed: false; reason: 'auth_required' | 'protected' };

export function exportPolicy(work: ExportableWork, viewer: ExportViewer): ExportDecision {
  const isClassic = work.is_classic === true || work.is_classic === 1;

  if (!viewer) {
    // Классика — public domain: качать может любой, без водяного знака.
    if (isClassic) return { allowed: true, watermark: null, reason: 'public_domain' };
    return { allowed: false, reason: 'auth_required' };
  }

  if (viewer.role === 'admin' || viewer.role === 'moderator') {
    return { allowed: true, watermark: `staff:${viewer.uid}`, reason: 'admin' };
  }
  if (viewer.uid === work.author_id) {
    return { allowed: true, watermark: null, reason: 'owner' };
  }
  if (isClassic) {
    return { allowed: true, watermark: null, reason: 'public_domain' };
  }
  // Купленное/подписное — не повод отдавать файл: текст остаётся на платформе.
  return { allowed: false, reason: 'protected' };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ExportChapter = { number: number; title: string; html: string };

export type ExportOptions = {
  watermark?: string | null;
  includeToc?: boolean;
  title?: string;
  author?: string;
};

/** HTML-документ для печати: кириллица, разрывы страниц, колонтитул с меткой. */
export function buildExportHtml(chapters: ExportChapter[], opts: ExportOptions = {}): string {
  const title = escapeHtml(opts.title || 'TeroLibrary');
  const author = escapeHtml(opts.author || '');
  const mark = opts.watermark ? escapeHtml(opts.watermark) : '';

  const toc = opts.includeToc === false ? '' : `
    <nav class="toc">
      <h2>Sadržaj</h2>
      <ol>
        ${chapters.map((c) => `<li>${escapeHtml(String(c.number))}. ${escapeHtml(c.title || `Glava ${c.number}`)}</li>`).join('')}
      </ol>
    </nav>`;

  const body = chapters.map((c) => `
    <section class="chapter">
      <h2>${escapeHtml(String(c.number))}. ${escapeHtml(c.title || `Glava ${c.number}`)}</h2>
      ${c.html || '<p></p>'}
    </section>`).join('');

  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A5; margin: 18mm 16mm; @bottom-center { content: "${mark}"; font-size: 8pt; color: #777; } }
  body { font-family: Georgia, 'DejaVu Serif', serif; font-size: 11pt; line-height: 1.55; color: #111; }
  h1 { font-size: 22pt; margin: 0 0 4mm; }
  .author { color: #555; margin-bottom: 10mm; }
  .toc { margin: 0 0 10mm; }
  .toc h2 { font-size: 13pt; }
  .toc ol { padding-left: 6mm; }
  .chapter { break-before: page; }
  .chapter:first-of-type { break-before: auto; }
  .chapter h2 { font-size: 15pt; margin-bottom: 4mm; }
  p { margin: 0 0 3.2mm; text-align: justify; }
  blockquote { margin: 0 6mm 3mm; color: #333; }
  img { max-width: 100%; }
  .wm { display: none; }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${author ? `<div class="author">${author}</div>` : ''}
  ${toc}
  ${body}
</body>
</html>`;
}

export type RenderResult = { ok: true; pdf: Buffer } | { ok: false; error: 'engine_missing' | 'failed' | 'empty' };

const MAX_HTML_BYTES = 6_000_000;

/** Рендер PDF через headless Chrome: он есть в системе и умеет кириллицу. */
export async function renderPdf(html: string, timeoutMs = 30_000): Promise<RenderResult> {
  if (!html || Buffer.byteLength(html, 'utf8') === 0) return { ok: false, error: 'empty' };
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return { ok: false, error: 'empty' };

  const dir = await mkdtemp(path.join(tmpdir(), 'reader-export-'));
  const htmlPath = path.join(dir, 'doc.html');
  const pdfPath = path.join(dir, 'doc.pdf');
  const profile = path.join(dir, 'chrome-profile');

  try {
    await writeFile(htmlPath, html, 'utf8');
    await run('google-chrome', [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      `--user-data-dir=${profile}`,
      '--virtual-time-budget=5000',
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, HOME: dir } });

    const pdf = await readFile(pdfPath);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') return { ok: false, error: 'failed' };
    return { ok: true, pdf };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'ENOENT') return { ok: false, error: 'engine_missing' };
    return { ok: false, error: 'failed' };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
