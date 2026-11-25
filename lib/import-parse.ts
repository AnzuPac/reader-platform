import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { pdfToHtml } from './pdf';

export type ImportChapter = { title: string; html: string; words: number };
export type ImportPreview = { title: string; chapters: ImportChapter[]; warnings: string[]; totalWords: number };

const ALLOWED = ['p','br','h1','h2','h3','strong','em','u','li','ul','ol','blockquote','hr','img'];
const ATTR = ['src','alt'];

export function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').split(/\s+/).filter(Boolean).length;
}

/** Разбор файла в HTML. Ошибки — кодами, без исключений наружу. */
export async function parseImportFile(name: string, buf: Buffer): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const lower = name.toLowerCase();
  try {
    let html = '';
    if (lower.endsWith('.docx')) {
      html = (await mammoth.convertToHtml({ buffer: buf })).value;
    } else if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      html = await marked.parse(buf.toString('utf8'));
    } else if (lower.endsWith('.txt')) {
      html = buf.toString('utf8').split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    } else if (lower.endsWith('.pdf')) {
      const r = await pdfToHtml(buf);
      if (!r.ok) return { ok: false, error: r.error === 'no_text' ? 'pdf_no_text' : 'pdf_failed' };
      html = r.html;
    } else {
      return { ok: false, error: 'unsupported' };
    }
    const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ALLOWED, ALLOWED_ATTR: ATTR });
    return { ok: true, html: clean };
  } catch (e) {
    return { ok: false, error: 'parse_failed' };
  }
}

/** Делит HTML на главы по h1/h2. Без заголовков — одна глава. */
export function splitIntoChapters(html: string, fallbackTitle: string): ImportChapter[] {
  const re = /<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = [...html.matchAll(re)];

  if (!matches.length) {
    return [{ title: fallbackTitle, html, words: countWords(html) }];
  }

  const chapters: ImportChapter[] = [];
  const first = matches[0].index ?? 0;
  const before = html.slice(0, first).trim();
  if (countWords(before) > 0) {
    chapters.push({ title: 'Начало', html: before, words: countWords(before) });
  }

  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? html.length) : html.length;
    const body = html.slice(start, end).trim();
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || `Глава ${chapters.length + 1}`;
    chapters.push({ title: title.slice(0, 200), html: body, words: countWords(body) });
  });

  return chapters.slice(0, 200);
}

export async function buildPreview(name: string, buf: Buffer): Promise<ImportPreview | { error: string }> {
  const parsed = await parseImportFile(name, buf);
  if (!parsed.ok) return { error: parsed.error };

  const warnings: string[] = [];
  const fallback = name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Импорт';
  const chapters = splitIntoChapters(parsed.html, fallback);

  const images = (parsed.html.match(/<img\b/gi) || []).length;
  if (images) warnings.push(`Изображений: ${images}. Они остаются в тексте, но проверьте отображение.`);
  chapters.forEach((c, i) => { if (!c.words) warnings.push(`Глава ${i + 1} «${c.title}» пустая.`); });
  if (!chapters.length) warnings.push('Не удалось выделить главы — проверьте файл.');
  if (chapters.length > 100) warnings.push('Глав больше 100 — проверьте разбиение.');

  const totalWords = chapters.reduce((sum, c) => sum + c.words, 0);
  const title = chapters.length === 1 ? fallback : fallback;
  return { title, chapters, warnings, totalWords };
}
