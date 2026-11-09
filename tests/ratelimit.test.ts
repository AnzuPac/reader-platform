import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit } from '../lib/ratelimit';

describe('ограничитель частоты', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('пропускает первые N запросов', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('t1', 3, 60_000).ok).toBe(true);
    }
  });

  it('блокирует запрос сверх лимита и сообщает задержку', () => {
    rateLimit('t2', 2, 60_000);
    rateLimit('t2', 2, 60_000);
    const res = rateLimit('t2', 2, 60_000);
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThan(0);
  });

  it('разные ключи не мешают друг другу', () => {
    rateLimit('a', 1, 60_000);
    expect(rateLimit('a', 1, 60_000).ok).toBe(false);
    expect(rateLimit('b', 1, 60_000).ok).toBe(true);
  });

  it('окно сбрасывается', () => {
    vi.useFakeTimers();
    rateLimit('t3', 1, 1000);
    expect(rateLimit('t3', 1, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(rateLimit('t3', 1, 1000).ok).toBe(true);
    vi.useRealTimers();
  });
});
