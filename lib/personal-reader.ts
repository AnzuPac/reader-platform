/** Нормализация и разбиение текста для личных TXT-файлов. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

export function isTextFormat(format: string): boolean {
  return format === 'txt';
}

export function isInlineViewable(format: string): boolean {
  return format === 'pdf';
}
