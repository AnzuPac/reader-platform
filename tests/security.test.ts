import { describe, it, expect } from 'vitest';
import { rateLimit } from '../lib/ratelimit';
import { decideDevice, deviceFingerprint, DEVICE_LIMIT } from '../lib/devices';

describe('rate limit выдачи текста', () => {
  it('пропускает 60 запросов в минуту и блокирует 61-й', () => {
    const key = `chapter-text:test-${Date.now()}`;
    for (let i = 0; i < 60; i += 1) {
      expect(rateLimit(key, 60, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 60, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});

describe('лимит устройств', () => {
  it('известное устройство пропускается всегда', () => {
    expect(decideDevice(true, DEVICE_LIMIT)).toBe('known');
    expect(decideDevice(true, 99)).toBe('known');
  });

  it('новое устройство пускается, пока есть место', () => {
    expect(decideDevice(false, 0)).toBe('allow_new');
    expect(decideDevice(false, DEVICE_LIMIT - 1)).toBe('allow_new');
  });

  it('сверх лимита новое устройство блокируется', () => {
    expect(decideDevice(false, DEVICE_LIMIT)).toBe('blocked');
    expect(decideDevice(false, DEVICE_LIMIT + 1)).toBe('blocked');
  });

  it('отпечаток стабилен для одного браузера и различается для другого', () => {
    const mk = (ua: string, ip: string) =>
      new Request('http://localhost/api/chapter/text', {
        headers: { 'user-agent': ua, 'x-forwarded-for': ip },
      });
    const a = deviceFingerprint(mk('Browser/1', '10.0.0.1'));
    const b = deviceFingerprint(mk('Browser/1', '10.0.0.1'));
    const c = deviceFingerprint(mk('Browser/2', '10.0.0.1'));
    expect(a.deviceHash).toBe(b.deviceHash);
    expect(a.deviceHash).not.toBe(c.deviceHash);
  });
});
