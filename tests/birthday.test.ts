import { describe, it, expect } from 'vitest';
import { giftWindow, DEFAULT_GIFT } from '../lib/birthday';

const at = (iso: string) => new Date(iso);

describe('окно подарка на день рождения', () => {
  it('в сам день рождения — подарок доступен', () => {
    const r = giftWindow('2000-11-19', at('2026-11-19T10:00:00Z'), 3);
    expect(r.inWindow).toBe(true);
    expect(r.daysUntil).toBe(0);
  });

  it('за день до — ещё рано', () => {
    const r = giftWindow('2000-11-20', at('2026-11-19T10:00:00Z'), 3);
    expect(r.inWindow).toBe(false);
    expect(r.daysUntil).toBe(1);
  });

  it('льготные дни после рождения работают', () => {
    expect(giftWindow('2000-11-17', at('2026-11-19T10:00:00Z'), 3).inWindow).toBe(true);
    expect(giftWindow('2000-11-17', at('2026-11-19T10:00:00Z'), 0).inWindow).toBe(false);
  });

  it('спустя окно — недоступен', () => {
    const r = giftWindow('2000-11-01', at('2026-11-19T10:00:00Z'), 3);
    expect(r.inWindow).toBe(false);
    expect(r.daysUntil).toBeLessThan(0);
  });

  it('29 февраля в обычный год празднуется 28-го', () => {
    const r = giftWindow('2000-02-29', at('2026-02-28T10:00:00Z'), 0);
    expect(r.inWindow).toBe(true);
  });

  it('битая дата не даёт окна', () => {
    expect(giftWindow('не дата', at('2026-11-19T10:00:00Z'), 3).inWindow).toBe(false);
  });

  it('по умолчанию подарок выключен и не начисляет монеты', () => {
    expect(DEFAULT_GIFT.enabled).toBe(false);
    expect(DEFAULT_GIFT.coins).toBe(0);
  });
});
