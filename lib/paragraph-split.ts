/**
 * Разбор текста главы на абзацы (ТЗ 4.6, 5.4).
 *
 * От индекса абзаца зависит, к какому месту текста привязан комментарий,
 * поэтому правило одно и детерминированное:
 *
 *  1) если в content есть HTML-абзацы (<p>/<div>), индекс получает каждый
 *     блок верхнего уровня в порядке появления; заголовки, картинки, <hr> и
 *     прочий текст между блоками рисуются как есть и индекс НЕ занимают;
 *  2) если весь текст обёрнут в один div (обёртка редактора), обёртка
 *     снимается и индексы получают вложенные блоки;
 *  3) если разметки абзацев нет вовсе (импорт обычным текстом, абзацы через
 *     пустую строку), каждый кусок между пустыми строками — отдельный абзац
 *     и получает индекс.
 *
 * Пересчёт одного и того же content обязан давать те же номера, иначе
 * комментарий «съедет» на соседний абзац. Разбор строковый, DOM не нужен.
 */

export type ParagraphBlock = { kind: 'para' | 'raw'; html: string; index: number | null };

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Внутренность блока верхнего уровня: без внешнего открывающего и закрывающего тега. */
function innerOf(blockHtml: string): string {
  const openEnd = blockHtml.indexOf('>');
  const closeStart = blockHtml.lastIndexOf('</');
  if (openEnd < 0 || closeStart <= openEnd) return '';
  return blockHtml.slice(openEnd + 1, closeStart);
}

/** Блоки верхнего уровня <p>/<div> плюс то, что стоит между ними. */
function tokenizeHtml(html: string): ParagraphBlock[] {
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const blocks: ParagraphBlock[] = [];
  let depth = 0;
  let blockTag = '';
  let blockStart = -1;
  let cursor = 0;
  let index = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html)) !== null) {
    const name = m[1].toLowerCase();
    if (name !== 'p' && name !== 'div') continue;
    const closing = m[0].startsWith('</');
    const selfClosing = /\/>$/.test(m[0]);

    if (!closing) {
      if (depth === 0) {
        const raw = html.slice(cursor, m.index);
        if (raw.trim()) blocks.push({ kind: 'raw', html: raw, index: null });
        blockStart = m.index;
        blockTag = name;
        if (selfClosing) {
          blocks.push({ kind: 'para', html: html.slice(blockStart, tagRe.lastIndex), index: index++ });
          cursor = tagRe.lastIndex;
          blockStart = -1;
        } else {
          depth = 1;
        }
      } else if (name === blockTag) {
        depth += 1;
      }
    } else if (depth > 0 && name === blockTag) {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ kind: 'para', html: html.slice(blockStart, tagRe.lastIndex), index: index++ });
        cursor = tagRe.lastIndex;
        blockStart = -1;
      }
    }
  }

  const tail = html.slice(cursor);
  if (tail.trim()) blocks.push({ kind: 'raw', html: tail, index: null });
  return blocks;
}

export function splitParagraphs(content: string): ParagraphBlock[] {
  const html = String(content ?? '');

  if (!/<(p|div)\b/i.test(html)) {
    return html
      .split(/\n{2,}/)
      .filter((chunk) => chunk.trim().length > 0)
      .map((chunk, i) => ({ kind: 'para' as const, html: `<p>${escapeHtml(chunk)}</p>`, index: i }));
  }

  const blocks = tokenizeHtml(html);
  const paras = blocks.filter((b) => b.kind === 'para');
  if (paras.length === 1) {
    const inner = innerOf(paras[0].html);
    if (/<(p|div)\b/i.test(inner)) return splitParagraphs(inner);
  }
  return blocks;
}
