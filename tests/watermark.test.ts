import { describe, it, expect } from 'vitest';
import { encodeId, decodeId, decodeAll, stripWatermark, encodeWatermark } from '../lib/watermark';

describe('watermark', () => {
  it('кодирует и восстанавливает user_id', () => {
    for (const id of [1, 42, 777, 123456, 4294967295]) {
      expect(decodeId(encodeId(id))).toBe(id);
    }
  });

  it('по тексту с маркерами восстанавливается id', () => {
    const text = 'Prvi pasus.\n\nDrugi pasus.\n\nTreći pasus.\n\nČetvrti pasus.';
    const marked = encodeWatermark(text, 4242, 2);
    expect(marked).not.toBe(text);
    expect(decodeId(marked)).toBe(4242);
    expect(decodeAll(marked).every((id) => id === 4242)).toBe(true);
    expect(decodeAll(marked).length).toBeGreaterThan(0);
  });

  it('не ломает HTML и ставит маркер между абзацами', () => {
    const html = '<p>Jedan</p><p>Dva</p><p>Tri</p>';
    const marked = encodeWatermark(html, 7, 1);
    expect((marked.match(/<\/p>/g) || []).length).toBe(3);
    expect(decodeId(marked)).toBe(7);
  });

  it('stripWatermark убирает маркеры, оставляя текст', () => {
    const marked = encodeWatermark('Tekst bez markera.', 99);
    const clean = stripWatermark(marked);
    expect(clean).toBe('Tekst bez markera.');
    expect(decodeId(clean)).toBeNull();
  });

  it('обычный текст без маркера не декодируется', () => {
    expect(decodeId('običan tekst')).toBeNull();
    expect(decodeAll('')).toEqual([]);
  });
});
