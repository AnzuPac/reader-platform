import { describe, it, expect } from 'vitest';
import { splitIntoChapters, countWords } from '../lib/import-parse';

describe('импорт: разбиение на главы', () => {
  it('делит по h1/h2 и выносит заголовок в название', () => {
    const html = '<p>Вступление.</p><h1>Первая</h1><p>Текст первой главы.</p><h2>Вторая</h2><p>Текст второй.</p>';
    const chapters = splitIntoChapters(html, 'Книга');
    expect(chapters.map((c) => c.title)).toEqual(['Начало', 'Первая', 'Вторая']);
    expect(chapters[1].html).toContain('Текст первой');
  });
  it('без заголовков — одна глава с названием файла', () => {
    const chapters = splitIntoChapters('<p>Просто текст без заголовков.</p>', 'Моя книга');
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Моя книга');
  });
  it('считает слова без тегов', () => {
    expect(countWords('<p>раз два</p><p>три</p>')).toBe(3);
  });
});
