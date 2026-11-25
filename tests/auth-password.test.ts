import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword, needsRehash } from '../lib/auth';

describe('пароли: Argon2id', () => {
  it('хеширует и проверяет пароль', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });
  it('одинаковые пароли дают разные хеши (соль)', async () => {
    const a = await hashPassword('same password 123');
    const b = await hashPassword('same password 123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password 123', a)).toBe(true);
    expect(await verifyPassword('same password 123', b)).toBe(true);
  });
  it('принимает старый bcrypt-хеш и требует перехеширования', async () => {
    const legacy = await bcrypt.hash('legacy password', 11);
    expect(await verifyPassword('legacy password', legacy)).toBe(true);
    expect(await verifyPassword('nope', legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
  });
  it('не падает на мусорном хеше', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
