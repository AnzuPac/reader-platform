// Сербская нормализация (поиск, ТЗ 4.4) и транслитерация ћирилица ↔ латиница (ТЗ 4.6).
// Один источник правды: сюда смотрят поиск, читалка и seed.

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'č', џ: 'dž', ш: 'š',
  // заимствования из русского: поиск не должен разваливаться на смешанных текстах
  щ: 'š', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'ju', я: 'ja',
};

const LAT_TO_CYR: Array<[string, string]> = [
  ['lj', 'љ'], ['nj', 'њ'], ['dž', 'џ'],
  ['a', 'а'], ['b', 'б'], ['c', 'ц'], ['č', 'ч'], ['ć', 'ћ'], ['d', 'д'],
  ['đ', 'ђ'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'],
  ['j', 'ј'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'],
  ['p', 'п'], ['r', 'р'], ['s', 'с'], ['š', 'ш'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['z', 'з'], ['ž', 'ж'],
];

const DIACRITICS: Record<string, string> = {
  č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj', ð: 'dj',
};

function isUpper(ch: string): boolean {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Кириллица → латиница. Сохраняет регистр и всё, что не буква (пунктуация, пробелы). */
export function cyrToLat(text: string): string {
  let out = '';
  for (const ch of String(text ?? '')) {
    const mapped = CYR_TO_LAT[ch.toLowerCase()];
    if (mapped === undefined) { out += ch; continue; }
    out += isUpper(ch) ? capFirst(mapped) : mapped;
  }
  return out;
}

/** Латиница → кириллица. Диграфы lj/nj/dž обрабатываются до одиночных букв. */
export function latToCyr(text: string): string {
  const src = String(text ?? '');
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const pair = src.slice(i, i + 2).toLowerCase();
    const hit = LAT_TO_CYR.find(([lat]) => lat === pair);
    if (hit) {
      out += isUpper(ch) ? hit[1].toUpperCase() : hit[1];
      i += 1;
      continue;
    }
    const single = LAT_TO_CYR.find(([lat]) => lat === ch.toLowerCase());
    out += single ? (isUpper(ch) ? single[1].toUpperCase() : single[1]) : ch;
  }
  return out;
}

/** Переключение письма для читалки. */
export function translitSr(text: string, target: 'lat' | 'cir'): string {
  return target === 'lat' ? cyrToLat(text) : latToCyr(text);
}

/**
 * Нормализация для поиска: нижний регистр, кириллица → латиница,
 * снятие диакритики (č/ć→c, š→s, ž→z, đ→dj), всё небуквенное — в пробел.
 * «Андрић», «Andrić», «Andric» → один и тот же ключ «andric».
 */
export function normalizeSr(text: string): string {
  const latin = cyrToLat(String(text ?? '')).toLowerCase();
  let folded = '';
  for (const ch of latin) folded += DIACRITICS[ch] ?? ch;
  return folded
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Поле поиска произведения: нормализованные название + имя автора. */
export function composeSearchNorm(title: string, authorName: string): string {
  return normalizeSr(`${title} ${authorName}`);
}

export type Script = 'lat' | 'cir';

/** Определяет письмо текста по числу букв (null — букв нет). */
export function detectScript(text: string): Script | null {
  let cyr = 0;
  let lat = 0;
  for (const ch of String(text ?? '')) {
    if (CYR_TO_LAT[ch.toLowerCase()] !== undefined) cyr += 1;
    else if (/[a-zčćšžđ]/i.test(ch)) lat += 1;
  }
  if (!cyr && !lat) return null;
  return cyr >= lat ? 'cir' : 'lat';
}
