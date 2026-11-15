import { describe, it, expect } from 'vitest';
import { subscriptionAvailable, saleAvailable, regionAllowed } from '../lib/rights';

describe('права по книге (ТЗ 6.1)', () => {
  const day = 86_400_000;
  const published = new Date(Date.now() - 10 * day).toISOString();

  it('без окна подписка доступна сразу', () => {
    expect(subscriptionAvailable({ rights_subscription: 1, subscription_window_days: 0, published_at: published })).toBe(true);
  });

  it('окно новинки 30 дней блокирует подписку на 10-й день', () => {
    expect(subscriptionAvailable({ rights_subscription: 1, subscription_window_days: 30, published_at: published })).toBe(false);
  });

  it('после окна подписка снова доступна', () => {
    const old = new Date(Date.now() - 40 * day).toISOString();
    expect(subscriptionAvailable({ rights_subscription: 1, subscription_window_days: 30, published_at: old })).toBe(true);
  });

  it('право подписки выключено — недоступно', () => {
    expect(subscriptionAvailable({ rights_subscription: 0, subscription_window_days: 0, published_at: published })).toBe(false);
  });

  it('продажа и регионы', () => {
    expect(saleAvailable({ rights_sale: 1 })).toBe(true);
    expect(saleAvailable({ rights_sale: 0 })).toBe(false);
    expect(regionAllowed('RS,BA', 'ba')).toBe(true);
    expect(regionAllowed('RS', 'DE')).toBe(false);
    expect(regionAllowed('*', 'DE')).toBe(true);
  });
});
