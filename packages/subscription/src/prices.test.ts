import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  currencyForCountry,
  DEFAULT_CURRENCY,
  formatPrice,
  isCurrency,
  priceList,
  PRICES,
} from './prices';

describe('prices', () => {
  it("are the spec's, in every currency sold", () => {
    expect(PRICES).toEqual({
      GBP: { pro: 8, team: 6 },
      USD: { pro: 10, team: 8 },
      EUR: { pro: 9, team: 7 },
      CAD: { pro: 14, team: 11 },
      AUD: { pro: 15, team: 12 },
    });
    expect(Object.keys(PRICES)).toEqual([...CURRENCIES]);
    expect(DEFAULT_CURRENCY).toBe('GBP');
  });

  it("follow the visitor's country, and fall back to pounds", () => {
    expect(currencyForCountry('GB')).toBe('GBP');
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('CA')).toBe('CAD');
    expect(currencyForCountry('AU')).toBe('AUD');
    for (const country of ['DE', 'FR', 'IE', 'ES', 'IT', 'NL', 'HR']) {
      expect(currencyForCountry(country), country).toBe('EUR');
    }
    expect(currencyForCountry(' us ')).toBe('USD');
    for (const country of ['JP', 'CH', 'XX', 'T1', '', null, undefined]) {
      expect(currencyForCountry(country), String(country)).toBe('GBP');
    }
  });

  it('know a currency from anything else', () => {
    expect(isCurrency('EUR')).toBe(true);
    for (const value of ['eur', 'JPY', '', null, 5]) expect(isCurrency(value)).toBe(false);
  });

  it('list one currency and each paid tier in it', () => {
    expect(priceList('CAD')).toEqual({ currency: 'CAD', pro: 14, team: 11 });
  });

  it('are written as the locale writes them, without decimals when there are none', () => {
    expect(formatPrice(8, 'GBP', 'en-GB')).toBe('£8');
    expect(formatPrice(10, 'USD', 'en-US')).toBe('$10');
    expect(formatPrice(24, 'GBP', 'en-GB')).toBe('£24');
    expect(formatPrice(7.5, 'GBP', 'en-GB')).toBe('£7.5');
    expect(formatPrice(9, 'EUR', 'de-DE').replace(/\s/g, ' ')).toBe('9 €');
    expect(formatPrice(8, 'GBP')).toContain('8');
  });
});
