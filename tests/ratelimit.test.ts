import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let rateLimit: typeof import('../lib/ratelimit').rateLimit;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-rl-'));
  ({ rateLimit } = await import('../lib/ratelimit'));
});

describe('ограничитель частоты', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('пропускает первые N запросов', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit('t1', 3, 60_000);
      expect(r.ok).toBe(true);
    }
  });

  it('блокирует запрос сверх лимита и сообщает задержку', async () => {
    await rateLimit('t2', 2, 60_000);
    await rateLimit('t2', 2, 60_000);
    const res = await rateLimit('t2', 2, 60_000);
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThan(0);
  });

  it('разные ключи не мешают друг другу', async () => {
    await rateLimit('a', 1, 60_000);
    expect((await rateLimit('a', 1, 60_000)).ok).toBe(false);
    expect((await rateLimit('b', 1, 60_000)).ok).toBe(true);
  });

  it('окно сбрасывается', async () => {
    await rateLimit('t3', 1, 1000);
    expect((await rateLimit('t3', 1, 1000)).ok).toBe(false);
    // Ждём реального истечения окна: счётчик живёт в БД и сравнивает время по часам.
    await new Promise((r) => setTimeout(r, 1100));
    expect((await rateLimit('t3', 1, 1000)).ok).toBe(true);
  });
});
