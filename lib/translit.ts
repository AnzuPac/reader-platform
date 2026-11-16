/**
 * Сербская транслитерация: ćirilica ↔ latinica и нормализация для поиска.
 *
 * Таблица — стандартная сербская (Гай): č ć š ž đ ↔ ч ћ ш ж ђ,
 * диграфы lj nj dž ↔ љ њ џ. Регистр сохраняется, буквы вне сербского
 * алфавита (q, w, x, y) проходят как есть.
 */

const LAT_TO_CYR_SINGLE: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', č: 'ч', ć: 'ћ', d: 'д', đ: 'ђ', e: 'е', f: 'ф',
  g: 'г', h: 'х', i: 'и', j: 'ј', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о',
  p: 'п', r: 'р', s: 'с', š: 'ш', t: 'т', u: 'у', v: 'в', z: 'з', ž: 'ж',
};

const LAT_TO_CYR_DIGRAPH: Record<string, string> = { lj: 'љ', nj: 'њ', dž: 'џ' };

const CYR_TO_LAT_SINGLE: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'č', џ: 'dž', ш: 'š',
};

/** Диакритика → ASCII. đ даёт «dj», как принято в сербской латинице без диакритики. */
const FOLD: Record<string, string> = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj' };
const FOLD_UPPER: Record<string, string> = { č: 'C', ć: 'C', š: 'S', ž: 'Z', đ: 'Dj' };

function isUpper(ch: string): boolean {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Латиница → ćirilica. Диграфы lj/nj/dž обрабатываются до одиночных букв. */
export function latToCyr(text: string): string {
  const src = String(text ?? '');
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const pair = src.slice(i, i + 2).toLowerCase();
    const digraph = LAT_TO_CYR_DIGRAPH[pair];
    if (digraph) {
      out += isUpper(ch) ? digraph.toUpperCase() : digraph;
      i += 1;
      continue;
    }
    const mapped = LAT_TO_CYR_SINGLE[ch.toLowerCase()];
    out += mapped ? (isUpper(ch) ? mapped.toUpperCase() : mapped) : ch;
  }
  return out;
}

/** ćirilica → латиница. */
export function cyrToLat(text: string): string {
  const src = String(text ?? '');
  let out = '';
  for (const ch of src) {
    const mapped = CYR_TO_LAT_SINGLE[ch.toLowerCase()];
    if (!mapped) { out += ch; continue; }
    out += isUpper(ch) ? capFirst(mapped) : mapped;
  }
  return out;
}

/** Снятие сербской диакритики: č ć š ž đ → c c s z dj (для поиска). */
export function stripDiacritics(text: string): string {
  let out = '';
  for (const ch of String(text ?? '')) {
    const lower = ch.toLowerCase();
    if (lower === ch) out += FOLD[lower] ?? ch;
    else out += FOLD_UPPER[lower] ?? ch;
  }
  return out;
}

/**
 * Канонический ключ поиска: кириллица → латиница, диакритика снята,
 * нижний регистр, всё кроме букв и цифр — в пробел.
 * «Андрић», «Andrić» и «Andric» дают один ключ «andric».
 */
export function normalizeSr(text: string): string {
  const latin = cyrToLat(String(text ?? '')).toLowerCase();
  return stripDiacritics(latin)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type Script = 'lat' | 'cir';

/** Определяет письмо текста по числу букв (null — букв нет). */
export function detectScript(text: string): Script | null {
  let cyr = 0;
  let lat = 0;
  for (const ch of String(text ?? '')) {
    if (CYR_TO_LAT_SINGLE[ch.toLowerCase()]) cyr += 1;
    else if (/[a-zčćšžđ]/i.test(ch)) lat += 1;
  }
  if (!cyr && !lat) return null;
  return cyr >= lat ? 'cir' : 'lat';
}

/** Приводит текст к запрошенному письму (текст уже в нём — не меняется). */
export function toScript(text: string, script: Script): string {
  const src = String(text ?? '');
  return script === 'cir' ? latToCyr(src) : cyrToLat(src);
}
