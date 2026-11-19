/**
 * Подготовка текста для озвучки.
 *
 * Длинные куски Web Speech API некоторые движки обрывают или читают с
 * неестественными паузами, поэтому режем по предложениям с потолком длины.
 * Ничего не сохраняет — только нарезка в памяти.
 */
export function splitForSpeech(text: string, maxChars = 240): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (sentence.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      // Очень длинное предложение режем по словам.
      let part = '';
      for (const word of sentence.split(' ')) {
        if ((part + ' ' + word).trim().length > maxChars) {
          if (part) chunks.push(part.trim());
          part = word;
        } else {
          part = part ? `${part} ${word}` : word;
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    if ((current + ' ' + sentence).trim().length > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
