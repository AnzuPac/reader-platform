import { describe, it, expect, beforeAll } from 'vitest';
import { signChapterToken, verifyChapterToken } from '../lib/content-token';

beforeAll(() => { process.env.JWT_SECRET = 'test-secret-for-content-token'; });

describe('короткоживущий токен главы', () => {
  it('подписывает и проверяет', () => {
    const { token, exp } = signChapterToken(7, 42);
    const parsed = verifyChapterToken(token);
    expect(parsed?.uid).toBe(7);
    expect(parsed?.chapterId).toBe(42);
    expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
  it('не принимает поддельную подпись', () => {
    const { token } = signChapterToken(7, 42);
    const tampered = token.replace(/\.([^.]+)$/, '.AAAA');
    expect(verifyChapterToken(tampered)).toBeNull();
  });
  it('не принимает мусор', () => {
    expect(verifyChapterToken('')).toBeNull();
    expect(verifyChapterToken('1.2.3')).toBeNull();
  });
});
