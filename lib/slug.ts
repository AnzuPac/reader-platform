const MAP: Record<string, string> = {
  'š': 's', 'đ': 'dj', 'č': 'c', 'ć': 'c', 'ž': 'z',
  'Š': 's', 'Đ': 'dj', 'Č': 'c', 'Ć': 'c', 'Ž': 'z',
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'z', 'з': 'z',
  'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
  'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'c',
  'ш': 's', 'щ': 's', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'ju', 'я': 'ja',
};

export function translit(input: string): string {
  return input.replace(/[šđčćžŠĐČĆŽа-яА-Я]/g, (c) => {
    const lower = c.toLowerCase();
    const mapped = MAP[lower] ?? lower;
    const isUpper = c !== lower;
    return isUpper ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
  });
}

export function slugify(input: string): string {
  const cleaned = translit(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 60).replace(/-+$/g, '') || 'work';
}
