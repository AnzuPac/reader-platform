import { describe, it, expect } from 'vitest';
import { splitParagraphs } from '../lib/paragraph-split';

/**
 * Индекс абзаца — это адрес комментария (ТЗ 4.6, 5.4). Если разбор изменит
 * нумерацию, все существующие комментарии переедут на соседние абзацы,
 * поэтому правило зафиксировано тестами.
 */

const paraIndexes = (content: string) =>
  splitParagraphs(content).filter((b) => b.kind === 'para').map((b) => b.index);

describe('разбор абзацев: HTML', () => {
  it('каждый <p> получает номер по порядку с нуля', () => {
    expect(paraIndexes('<p>a</p><p>b</p><p>c</p>')).toEqual([0, 1, 2]);
  });

  it('заголовок между абзацами рисуется, но номер не занимает', () => {
    const blocks = splitParagraphs('<h1>Naslov</h1><p>a</p><p>b</p>');
    expect(blocks.map((b) => b.kind)).toEqual(['raw', 'para', 'para']);
    expect(paraIndexes('<h1>Naslov</h1><p>a</p><p>b</p>')).toEqual([0, 1]);
  });

  it('картинка между абзацами не сбивает нумерацию', () => {
    expect(paraIndexes('<p>a</p><img src="x.png"><p>b</p>')).toEqual([0, 1]);
  });

  it('обёртка <div> со вложенными абзацами снимается', () => {
    expect(paraIndexes('<div class="wrapper"><p>a</p><p>b</p></div>')).toEqual([0, 1]);
  });

  it('единственный настоящий абзац остаётся одним', () => {
    const blocks = splitParagraphs('<p>only</p>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].html).toBe('<p>only</p>');
    expect(blocks[0].index).toBe(0);
  });

  it('вложенный <div> внутри абзаца не считается отдельным абзацем', () => {
    expect(paraIndexes('<p>a<div>b</div></p><p>c</p>')).toEqual([0, 1]);
  });
});

describe('разбор абзацев: обычный текст', () => {
  it('абзацы разделяются пустой строкой', () => {
    expect(paraIndexes('# Glava 1\n\nPrvi pasus.\n\nDrugi pasus.')).toEqual([0, 1, 2]);
  });

  it('текст экранируется, а не вставляется как разметка', () => {
    const blocks = splitParagraphs('a < b\n\nc & d');
    expect(blocks[0].html).toBe('<p>a &lt; b</p>');
    expect(blocks[1].html).toBe('<p>c &amp; d</p>');
  });

  it('пустые куски не создают абзацев', () => {
    expect(paraIndexes(' \n\n\n\n Текст \n\n \n\n')).toEqual([0]);
  });
});

describe('разбор абзацев: стабильность нумерации', () => {
  it('повторный разбор того же текста даёт те же номера', () => {
    const html = '<p>a</p><h2>t</h2><p>b</p><div><p>c</p><p>d</p></div>';
    expect(paraIndexes(html)).toEqual(paraIndexes(html));
  });

  it('пустой текст не даёт абзацев', () => {
    expect(paraIndexes('')).toEqual([]);
  });
});
