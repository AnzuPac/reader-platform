import { describe, it, expect } from 'vitest';
import { canReadChapter } from '../lib/access';

const base = { loggedIn: false, hasEntitlement: false, hasActiveSubscription: false };

describe('доступ к главе', () => {
  it('бесплатная глава открыта всем', () => {
    expect(canReadChapter({ ...base, access: 'free' })).toBe(true);
  });
  it('глава для подписчиков закрыта анониму', () => {
    expect(canReadChapter({ ...base, access: 'subscribers' })).toBe(false);
  });
  it('глава для подписчиков открыта подписчику', () => {
    expect(canReadChapter({ ...base, access: 'subscribers', loggedIn: true, hasActiveSubscription: true })).toBe(true);
  });
  it('платная глава НЕ открывается подпиской', () => {
    expect(canReadChapter({ ...base, access: 'paid', loggedIn: true, hasActiveSubscription: true })).toBe(false);
  });
  it('платная глава открывается купленным доступом', () => {
    expect(canReadChapter({ ...base, access: 'paid', loggedIn: true, hasEntitlement: true })).toBe(true);
  });
  it('без входа доступ запрещён даже при наличии флага', () => {
    expect(canReadChapter({ ...base, access: 'paid', hasEntitlement: true })).toBe(false);
  });
  it('неизвестный тип доступа закрыт', () => {
    expect(canReadChapter({ ...base, access: 'weird' as any, loggedIn: true, hasEntitlement: true })).toBe(true);
    expect(canReadChapter({ ...base, access: 'weird' as any })).toBe(false);
  });
});
