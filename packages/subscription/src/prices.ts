// What each paid tier costs, in each currency it is sold in (subscription.md "Price"). Monthly only. Every amount is
// a set figure for its currency, in whole units, never a conversion. With Stripe these mirror each Price's
// per-currency amounts.

import type { Tier } from './tiers';

export const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'GBP';

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}

export type PaidTier = Exclude<Tier, 'free'>;

/** A month of Pro, and a month of one member of Pro for Teams. */
export const PRICES: Record<Currency, Record<PaidTier, number>> = {
  GBP: { pro: 8, team: 6 },
  USD: { pro: 10, team: 8 },
  EUR: { pro: 9, team: 7 },
  CAD: { pro: 14, team: 11 },
  AUD: { pro: 15, team: 12 },
};

const EURO_COUNTRIES = [
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
] as const;

const COUNTRY_CURRENCY = new Map<string, Currency>([
  ['GB', 'GBP'],
  ['US', 'USD'],
  ['CA', 'CAD'],
  ['AU', 'AUD'],
  ...EURO_COUNTRIES.map((country): [string, Currency] => [country, 'EUR']),
]);

/** The currency a visitor in `country` (ISO 3166-1 alpha-2, as Cloudflare's `cf.country`) is shown. */
export function currencyForCountry(country: string | null | undefined): Currency {
  if (typeof country !== 'string') return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY.get(country.trim().toUpperCase()) ?? DEFAULT_CURRENCY;
}

/** The prices a page shows: one currency and each paid tier's monthly amount in it. */
export type PriceList = { currency: Currency; pro: number; team: number };

export function priceList(currency: Currency): PriceList {
  return { currency, ...PRICES[currency] };
}

/** An amount as the visitor's locale writes it, without decimals when it has none: £8, $10, 9 €. */
export function formatPrice(amount: number, currency: Currency, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
