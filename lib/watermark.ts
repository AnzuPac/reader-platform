/**
 * Невидимый водяной знак для платного текста.
 *
 * Идентификатор читателя кодируется символами нулевой ширины и вставляется
 * после каждого N-го абзаца. Текст визуально не меняется, но копия несёт
 * в себе user_id: по утёкшему фрагменту можно восстановить источник.
 *
 * Маркер: U+2060 (начало) + 32 бита (U+200B = 0, U+200C = 1) + U+2063 (конец).
 */

const ZERO = '\u200B';
const ONE = '\u200C';
const START = '\u2060';
const END = '\u2063';

const MARKER_RE = new RegExp(`${START}([${ZERO}${ONE}]{32})${END}`, 'g');

export function encodeId(userId: number): string {
  const n = Math.trunc(Number(userId));
  if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) {
    throw new Error('watermark: user id out of range');
  }
  const bits = n.toString(2).padStart(32, '0');
  let out = START;
  for (const b of bits) out += b === '1' ? ONE : ZERO;
  return out + END;
}

/** Первый валидный id из произвольного текста (null — маркера нет). */
export function decodeId(text: string): number | null {
  MARKER_RE.lastIndex = 0;
  const m = MARKER_RE.exec(String(text ?? ''));
  if (!m) return null;
  let value = 0;
  for (const ch of m[1]) value = value * 2 + (ch === ONE ? 1 : 0);
  return value >>> 0;
}

/** Все id, встреченные в тексте (для проверки утечки). */
export function decodeAll(text: string): number[] {
  const src = String(text ?? '');
  const ids: number[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(src))) {
    let value = 0;
    for (const ch of m[1]) value = value * 2 + (ch === ONE ? 1 : 0);
    ids.push(value >>> 0);
  }
  return ids;
}

export function stripWatermark(text: string): string {
  return String(text ?? '').replace(MARKER_RE, '');
}

/**
 * Вставляет маркер в текст или HTML после каждого `every`-го абзаца.
 * HTML не ломается: маркер ставится между блоками, а не внутрь тега.
 */
export function encodeWatermark(text: string, userId: number, every = 3): string {
  const src = String(text ?? '');
  if (!src) return src;
  const marker = encodeId(userId);
  const n = Math.max(1, Math.trunc(every) || 3);

  if (src.includes('</p>')) {
    const parts = src.split('</p>');
    let out = '';
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        out += part;
        return;
      }
      out += part + '</p>';
      if ((i + 1) % n === 0) out += marker;
    });
    return out.includes(marker) ? out : out + marker;
  }

  const lines = src.split('\n');
  if (lines.length > 1) {
    let seen = 0;
    return lines
      .map((line, i) => {
        if (i === lines.length - 1) return line;
        if (line.trim()) seen += 1;
        return line + (seen > 0 && seen % n === 0 ? marker : '');
      })
      .join('\n');
  }

  return src + marker;
}
