import { describe, it, expect } from 'vitest';
import { planLimit, formatBytes } from '../lib/storage';

describe('лимиты хранилища', () => {
  it('free — 1 ГБ', () => expect(planLimit('free')).toBe(1024 ** 3));
  it('reader — 5 ГБ', () => expect(planLimit('reader')).toBe(5 * 1024 ** 3));
  it('reader_plus — 20 ГБ', () => expect(planLimit('reader_plus')).toBe(20 * 1024 ** 3));
  it('неизвестный тариф — как free', () => expect(planLimit('whatever')).toBe(1024 ** 3));
});

describe('формат размеров', () => {
  it('байты', () => expect(formatBytes(500)).toBe('500 B'));
  it('килобайты', () => expect(formatBytes(2048)).toBe('2.0 KB'));
  it('мегабайты', () => expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB'));
  it('гигабайты', () => expect(formatBytes(1024 ** 3)).toBe('1.00 GB'));
});
