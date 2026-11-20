import { describe, it, expect } from 'vitest';
import { isCommerciallyEligible } from '../lib/work-monetization-rules';

describe('monetization policy', () => {
  it('allows original self-published works', () => expect(isCommerciallyEligible({ kind: 'original', is_classic: false, publisher_id: null })).toBe(true));
  it('allows original comics', () => expect(isCommerciallyEligible({ kind: 'original', type: 'comic', is_classic: false })).toBe(true));
  it('blocks fanfiction regardless of format', () => expect(isCommerciallyEligible({ kind: 'fanfic', type: 'comic', is_classic: false })).toBe(false));
  it('blocks public-domain works', () => expect(isCommerciallyEligible({ kind: 'original', is_classic: true })).toBe(false));
  it('defaults missing kind to original for legacy records', () => expect(isCommerciallyEligible({ is_classic: false })).toBe(true));
  it('blocks commercial sale when rights are not confirmed', () => expect(isCommerciallyEligible({ kind: 'original', is_classic: false, rights_confirmed: false })).toBe(false));
  it('allows legacy original records with default rights confirmation', () => expect(isCommerciallyEligible({ kind: 'original', is_classic: false, rights_confirmed: true })).toBe(true));
});
