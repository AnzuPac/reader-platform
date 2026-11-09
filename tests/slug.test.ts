import { describe, it, expect } from 'vitest';
import { slugify, translit } from '../lib/slug';

describe('translit', () => {
  it('переводит сербскую диакритику в латиницу', () => {
    expect(translit('Noćna Straža')).toBe('Nocna Straza');
    expect(translit('Đorđe Čukić')).toBe('Djordje Cukic');
  });
  it('переводит кириллицу', () => {
    expect(translit('Ночная стража')).toBe('Nocnaja straza');
  });
});

describe('slugify', () => {
  it('делает чистый слаг', () => {
    expect(slugify('Noćna Straža')).toBe('nocna-straza');
  });
  it('убирает лишние символы и дефисы по краям', () => {
    expect(slugify('  Krvavi   Mesec!!! ')).toBe('krvavi-mesec');
  });
  it('не падает на пустом названии', () => {
    expect(slugify('***')).toBe('work');
  });
  it('ограничивает длину 60 символами', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
  it('не оставляет дефис в конце после обрезки', () => {
    const s = slugify('ab '.repeat(30));
    expect(s.endsWith('-')).toBe(false);
  });
});
