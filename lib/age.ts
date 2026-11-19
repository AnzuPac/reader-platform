/**
 * Возраст и возрастные группы.
 *
 * Одна точка правды: регистрация проверяет возраст, статистика автора строит
 * группы, подарки на день рождения проверяют дату. Раньше расчёт был только
 * внутри author-stats, и любая другая проверка дублировала бы логику.
 */

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** ISO-дата (YYYY-MM-DD). Возвращает null, если строка не дата или дата в будущем. */
export function parseBirthDate(value: unknown, now = new Date()): Date | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Отсекаем 2026-02-31: Date молча переносит на март.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (date.getTime() > now.getTime()) return null;
  if (y < 1900) return null;
  return date;
}

/** Полных лет на дату now. */
export function calcAge(birth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export type AgeGroup = '<18' | '18-24' | '25-34' | '35-44' | '45-54' | '55+' | 'unknown';

export const AGE_GROUPS: AgeGroup[] = ['<18', '18-24', '25-34', '35-44', '45-54', '55+', 'unknown'];

export function ageGroup(age: number | null): AgeGroup {
  if (age === null || !Number.isFinite(age) || age < 0 || age > 120) return 'unknown';
  if (age < ADULT_AGE) return '<18';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

/** Группа по строке даты рождения — для агрегатов, где хранится только текст. */
export function groupForBirthDate(birthDate: string | null | undefined, now = new Date()): AgeGroup {
  if (!birthDate) return 'unknown';
  const birth = parseBirthDate(String(birthDate).slice(0, 10), now);
  if (!birth) return 'unknown';
  return ageGroup(calcAge(birth, now));
}

export function isMinor(birthDate: string | null | undefined, now = new Date()): boolean {
  const g = groupForBirthDate(birthDate, now);
  return g === '<18';
}

/**
 * Порог приватности: группа меньше порога не показывается отдельно,
 * иначе по статистике можно опознать конкретного читателя (ФЗ/ZZPL, GDPR).
 */
export const MIN_AGE_BUCKET = 5;

/** Схлопывает мелкие группы в «other» и возвращает флаг, было ли схлопывание. */
export function maskSmallBuckets(counts: Record<string, number>, minBucket = MIN_AGE_BUCKET): { visible: Record<string, number>; hidden: number } {
  const visible: Record<string, number> = {};
  let hidden = 0;
  for (const [key, value] of Object.entries(counts)) {
    if (key === 'unknown') { visible[key] = value; continue; }
    if (value >= minBucket) visible[key] = value;
    else hidden += value;
  }
  if (hidden > 0) visible.other = (visible.other || 0) + hidden;
  return { visible, hidden };
}
