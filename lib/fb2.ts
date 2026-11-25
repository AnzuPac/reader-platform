import DOMPurify from 'isomorphic-dompurify';

export type Fb2Chapter = { title: string; html: string };
export type ParsedFb2 = { title: string; author: string; chapters: Fb2Chapter[] };

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

/** Инлайн-теги FB2 → HTML, остальное вырезаем. */
function inline(fragment: string): string {
  // Сначала убираем все теги, кроме разрешённых инлайн-тегов FB2, затем
  // превращаем их в HTML. Иначе `<em>` вырезался тем же проходом.
  const known = /^(\/?)(emphasis|strong|strikethrough|code)\b/i;
  const stripped = fragment.replace(/<[^>]+>/g, (tag) => (known.test(tag.slice(1, -1)) ? tag : ''));
  const converted = stripped
    .replace(/<emphasis[^>]*>/gi, '<em>').replace(/<\/emphasis>/gi, '</em>')
    .replace(/<strong[^>]*>/gi, '<strong>').replace(/<\/strong>/gi, '</strong>')
    .replace(/<strikethrough[^>]*>/gi, '<s>').replace(/<\/strikethrough>/gi, '</s>')
    .replace(/<code[^>]*>/gi, '<code>').replace(/<\/code>/gi, '</code>');
  return DOMPurify.sanitize(converted, { ALLOWED_TAGS: ['em', 'strong', 's', 'code'], ALLOWED_ATTR: [] });
}

function sectionTitle(section: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(section);
  if (!title) return '';
  const paragraphs = [...title[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1]));
  const text = paragraphs.filter(Boolean).join(' ').trim();
  return text || textOf(title[1]);
}

function sectionHtml(section: string): string {
  const body = section.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '');
  const parts: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>|<subtitle[^>]*>([\s\S]*?)<\/subtitle>|<empty-line\s*\/?>/gi;
  for (const m of body.matchAll(re)) {
    if (m[2] !== undefined) {
      const text = textOf(m[2]);
      if (text) parts.push(`<h3>${DOMPurify.sanitize(text)}</h3>`);
    } else if (m[1] !== undefined) {
      const html = inline(m[1]);
      if (html.trim()) parts.push(`<p>${html}</p>`);
    } else {
      parts.push('<br/>');
    }
  }
  if (!parts.length) {
    const text = textOf(body);
    if (text) parts.push(`<p>${DOMPurify.sanitize(text)}</p>`);
  }
  return parts.join('');
}

/** Топ-уровневые секции с учётом вложенности. */
function topLevelSections(xml: string): string[] {
  const result: string[] = [];
  const re = /<section\b[^>]*>|<\/section>/gi;
  let depth = 0;
  let start = -1;
  for (const m of xml.matchAll(re)) {
    if (m[0].toLowerCase().startsWith('<section')) {
      if (depth === 0) start = m.index ?? 0;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        result.push(xml.slice(start, (m.index ?? 0) + m[0].length));
        start = -1;
      }
    }
  }
  return result;
}

export function parseFb2(buf: Buffer): ParsedFb2 {
  // Скрипты и стили вырезаем целиком, вместе с содержимым: просто снять
  // теги недостаточно — текст `alert(1)` остался бы в книге.
  const xml = buf.toString('utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (!/<FictionBook/i.test(xml)) throw new Error('fb2_invalid');

  const bookTitle = /<book-title[^>]*>([\s\S]*?)<\/book-title>/i.exec(xml)?.[1];
  const firstName = /<first-name[^>]*>([\s\S]*?)<\/first-name>/i.exec(xml)?.[1];
  const lastName = /<last-name[^>]*>([\s\S]*?)<\/last-name>/i.exec(xml)?.[1];
  const title = textOf(bookTitle || 'FB2').slice(0, 300) || 'FB2';
  const author = [textOf(firstName || ''), textOf(lastName || '')].filter(Boolean).join(' ').slice(0, 200);

  const bodies = [...xml.matchAll(/<body[^>]*>([\s\S]*?)<\/body>/gi)].map((m) => m[1]);
  const source = bodies.length ? bodies.join('\n') : xml;
  let sections = topLevelSections(source);
  if (!sections.length) sections = [source];

  const chapters: Fb2Chapter[] = [];
  for (const section of sections) {
    const html = sectionHtml(section);
    if (!html.trim()) continue;
    chapters.push({ title: sectionTitle(section) || `Глава ${chapters.length + 1}`, html });
  }
  if (!chapters.length) throw new Error('fb2_empty');
  return { title, author, chapters };
}
