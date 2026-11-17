import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { escapeHtml, pdfToHtml } from '../lib/pdf';

describe('импорт PDF (текстовый слой)', () => {
  it('извлекает абзацы и слова из текстового PDF', async () => {
    const buf = readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'pdf-src.pdf'));
    const r = await pdfToHtml(buf, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.words).toBeGreaterThan(10);
      expect(r.html).toContain('<p>');
      expect(r.html).toContain('Prvi pasus');
    }
  });

  it('честно отклоняет файл без текстового слоя', async () => {
    const r = await pdfToHtml(Buffer.from('это не pdf'), 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['no_text', 'failed']).toContain(r.error);
  });

  it('экранирует HTML в тексте', () => {
    expect(escapeHtml('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  });
});
