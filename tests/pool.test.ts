import { describe, it, expect } from 'vitest';
import { normalizeReadings, distributePool, PAGES_CAP } from '../lib/pool';

const workPages = { 1: 100, 2: 400 };

describe('подписочный пул (ТЗ 7.4)', () => {
  it('порог: короткие чтения не учитываются', () => {
    const kept = normalizeReadings([
      { userId: 1, workId: 1, pages: 5 },    // меньше 20
      { userId: 1, workId: 2, pages: 30 },   // 7.5% книги — ниже 10%
      { userId: 1, workId: 1, pages: 25 },   // ок
    ], workPages);
    expect(kept.length).toBe(1);
    expect(kept[0].pages).toBe(25);
  });

  it('потолок 3000 страниц на пользователя', () => {
    const readings = [{ userId: 7, workId: 1, pages: 9000 }];
    const kept = normalizeReadings(readings, { 1: 20000 });
    expect(kept[0].pages).toBe(PAGES_CAP);
  });

  it('пропорциональное масштабирование при превышении потолка', () => {
    const kept = normalizeReadings([
      { userId: 7, workId: 1, pages: 4000 },
      { userId: 7, workId: 2, pages: 2000 },
    ], { 1: 10000, 2: 10000 });
    const sum = kept.reduce((a, b) => a + b.pages, 0);
    expect(sum).toBeLessThanOrEqual(PAGES_CAP);
    expect(kept[0].pages).toBeGreaterThan(kept[1].pages);
  });

  it('распределение сходится к пулу и делит по страницам', () => {
    const readings = [
      { userId: 1, workId: 1, pages: 100 },
      { userId: 2, workId: 2, pages: 300 },
    ];
    const res = distributePool(10_000, readings);
    expect(res.distributed_cents).toBe(10_000);
    const w1 = res.byWork.find((w) => w.workId === 1)!;
    const w2 = res.byWork.find((w) => w.workId === 2)!;
    expect(w1.cents).toBe(2_500);
    expect(w2.cents).toBe(7_500);
  });

  it('пустой месяц — пул не распределён', () => {
    const res = distributePool(5_000, []);
    expect(res.distributed_cents).toBe(0);
    expect(res.byWork.length).toBe(0);
  });
});
