import { describe, expect, it } from 'vitest';
import { localeCurrency } from './locale-currency';

describe('localeCurrency', () => {
  it('maps a locale region to a common currency', () => {
    expect(localeCurrency('en-GB')).toBe('GBP');
    expect(localeCurrency('en-US')).toBe('USD');
    expect(localeCurrency('de-DE')).toBe('EUR');
    expect(localeCurrency('fr')).toBe('EUR');
    expect(localeCurrency('ja')).toBe('JPY');
  });

  it('gives undefined for no locale, a bad one or an unmapped region', () => {
    expect(localeCurrency(undefined)).toBeUndefined();
    expect(localeCurrency('')).toBeUndefined();
    expect(localeCurrency('not a locale!!')).toBeUndefined();
    expect(localeCurrency('en-NZ')).toBeUndefined();
  });
});
