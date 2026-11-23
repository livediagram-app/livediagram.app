import { describe, expect, it } from 'vitest';
import { pricingHrefOn } from './context';

describe('pricingHrefOn', () => {
  it("is the pricing page on the service's origin, whatever slashes the origin ends with", () => {
    expect(pricingHrefOn('https://www.liveworkspace.app')).toBe(
      'https://www.liveworkspace.app/pricing',
    );
    expect(pricingHrefOn('http://localhost:3000//')).toBe('http://localhost:3000/pricing');
    expect(pricingHrefOn('')).toBe('/pricing');
  });

  it('stays linear on an origin with a long run of slashes that is not at its end', () => {
    // No timer: vitest's test timeout is the budget. `/\/+$/` takes minutes at this length, the scan a millisecond.
    const worst = `${'/'.repeat(200_000)}x`;
    expect(pricingHrefOn(`${worst}//`)).toBe(`${worst}/pricing`);
  });
});
