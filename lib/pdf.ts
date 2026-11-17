import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

/** HTML-экранирование текста из PDF. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type PdfResult =
  | { ok: true; html: string; words: number }
  | { ok: false; error: 'empty' | 'no_text' | 'failed' };

/**
 * Извлекает текст из PDF через poppler-utils (pdftotext).
 *
 * Работает с «текстовыми» PDF: тем, где текст хранится символами, а не картинкой.
 * Для сканов вернёт no_text — их нужно распознавать отдельно (OCR), иначе на выходе
 * получится пустая глава, что хуже честной ошибки.
 */
export async function pdfToHtml(buf: Buffer, minWords = 20): Promise<PdfResult> {
  const dir = await mkdtemp(path.join(tmpdir(), 'reader-pdf-'));
  const file = path.join(dir, 'in.pdf');
  try {
    await writeFile(file, buf);
    const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], {
      maxBuffer: 32 * 1024 * 1024,
    });
    const text = String(stdout).replace(/\r/g, '').replace(/\u0000/g, '');
    if (!text.trim()) return { ok: false, error: 'no_text' };

    // Абзацы: пустая строка — граница. Внутри абзаца мягкие переносы склеиваем пробелом.
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) =>
        p
          .split('\n')
          .map((line) => line.replace(/\s+$/g, ''))
          .join(' ')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
      )
      .filter(Boolean);

    const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    if (words < minWords) return { ok: false, error: 'no_text' };

    return {
      ok: true,
      html: paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''),
      words,
    };
  } catch {
    return { ok: false, error: 'failed' };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
