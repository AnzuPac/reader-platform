import { describe, it, expect } from 'vitest';
import { normalizeText, splitParagraphs, isInlineViewable } from '../lib/personal-reader';

describe('TXT-читалка', () => {
  it('убирает BOM, CRLF и нулевые байты', () => {
    expect(normalizeText('\uFEFFПривет\r\nмир\u0000')).toBe('Привет\nмир');
  });
  it('разбивает на абзацы по пустым строкам', () => {
    expect(splitParagraphs('Первый абзац.\n\nВторой\nабзац.')).toEqual(['Первый абзац.', 'Второй абзац.']);
  });
  it('пустой текст даёт пустой список', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([]);
  });
  it('PDF открывается встроенно, остальное — нет', () => {
    expect(isInlineViewable('pdf')).toBe(true);
    expect(isInlineViewable('epub')).toBe(false);
  });
});
