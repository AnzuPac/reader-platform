import { describe, it, expect } from 'vitest';
import { splitForSpeech } from '../lib/speech';

describe('нарезка текста для озвучки', () => {
  it('режет по предложениям и не превышает лимит', () => {
    const text = 'Prva rečenica. Druga rečenica je malo duža! Treća? Četvrta.';
    const chunks = splitForSpeech(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
    expect(chunks.join(' ')).toContain('Prva rečenica.');
  });

  it('очень длинное предложение режет по словам', () => {
    const long = Array.from({ length: 60 }, (_, i) => `reč${i}`).join(' ');
    const chunks = splitForSpeech(long, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
  });

  it('пустой текст даёт пустой список', () => {
    expect(splitForSpeech('   \n  ')).toEqual([]);
  });

  it('короткий текст остаётся одним куском', () => {
    expect(splitForSpeech('Kratko.')).toEqual(['Kratko.']);
  });
});
