import { describe, it, expect, afterEach } from 'vitest';
import { turnstileEnforced, verifyTurnstile } from '../lib/turnstile';

const saved = { secret: process.env.TURNSTILE_SECRET_KEY, enforce: process.env.TURNSTILE_ENFORCE };
afterEach(() => {
  if (saved.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = saved.secret;
  if (saved.enforce === undefined) delete process.env.TURNSTILE_ENFORCE; else process.env.TURNSTILE_ENFORCE = saved.enforce;
});

describe('Turnstile', () => {
  it('выключен, если нет ключа и принудительного режима', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_ENFORCE;
    expect(turnstileEnforced()).toBe(false);
    expect((await verifyTurnstile('')).ok).toBe(true);
  });
  it('включён принудительно, но без секрета — ошибка конфигурации, а не пропуск', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.TURNSTILE_ENFORCE = '1';
    expect(turnstileEnforced()).toBe(true);
    const res = await verifyTurnstile('token');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('turnstile_not_configured');
  });
  it('с секретом требует токен', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    const res = await verifyTurnstile('');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('turnstile_required');
  });
});
