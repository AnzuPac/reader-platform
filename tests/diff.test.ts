import { describe, it, expect } from 'vitest';
import { diffLines, diffStats } from '../lib/diff';

describe('построчный diff', () => {
  it('находит изменённую строку', () => {
    const ops = diffLines('a\nb\nc', 'a\nB\nc');
    expect(diffStats(ops)).toEqual({ added: 1, removed: 1 });
    expect(ops.filter((o) => o.type === 'same').map((o) => o.text)).toEqual(['a', 'c']);
  });
  it('одинаковый текст — без изменений', () => {
    const ops = diffLines('x\ny', 'x\ny');
    expect(diffStats(ops)).toEqual({ added: 0, removed: 0 });
  });
  it('добавление в конец', () => {
    const ops = diffLines('a', 'a\nb');
    expect(diffStats(ops)).toEqual({ added: 1, removed: 0 });
  });
  it('слишком большой фрагмент не считается построчно', () => {
    const big = Array.from({ length: 2100 }, (_, i) => `l${i}`).join('\n');
    expect(diffLines(big, big)[0].type).toBe('del');
  });
});
