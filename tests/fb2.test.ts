import { describe, it, expect } from 'vitest';
import { parseFb2 } from '../lib/fb2';

const sample = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
 <description><title-info>
  <book-title>Тестовая книга</book-title>
  <author><first-name>Иван</first-name><last-name>Петров</last-name></author>
 </title-info></description>
 <body>
  <section>
   <title><p>Первая глава</p></title>
   <p>Первый абзац с <emphasis>курсивом</emphasis>.</p>
   <p>Второй абзац.</p>
  </section>
  <section>
   <title><p>Вторая глава</p></title>
   <p>Текст второй главы.</p>
   <section><title><p>Подглава</p></title><p>Вложенный текст.</p></section>
  </section>
 </body>
</FictionBook>`;

describe('FB2-импорт', () => {
  it('читает название, автора и главы', () => {
    const fb2 = parseFb2(Buffer.from(sample));
    expect(fb2.title).toBe('Тестовая книга');
    expect(fb2.author).toBe('Иван Петров');
    expect(fb2.chapters.length).toBe(2);
    expect(fb2.chapters[0].title).toBe('Первая глава');
    expect(fb2.chapters[0].html).toContain('<em>курсивом</em>');
    expect(fb2.chapters[1].html).toContain('Текст второй главы');
  });
  it('вырезает скрипты', () => {
    const bad = sample.replace('Второй абзац.', '<script>alert(1)</script>Второй абзац.');
    const fb2 = parseFb2(Buffer.from(bad));
    expect(fb2.chapters[0].html).not.toContain('script');
    expect(fb2.chapters[0].html).not.toContain('alert');
  });
  it('не-FB2 отклоняется', () => {
    expect(() => parseFb2(Buffer.from('hello'))).toThrow(/fb2_invalid/);
  });
});
