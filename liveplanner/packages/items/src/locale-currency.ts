// The currency a browser locale implies (docs/specs/026-plan/item-types.md "Custom field kinds"): a new Deal's Value
// follows the person's region. Only the currencies a Currency field offers first (COMMON_CURRENCIES) are mapped; any
// other region gives undefined, and the field keeps the default.
const EURO_REGIONS = new Set([
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
]);
const REGION_CURRENCY: Readonly<Record<string, string>> = {
  GB: 'GBP',
  US: 'USD',
  JP: 'JPY',
  CA: 'CAD',
  AU: 'AUD',
  CH: 'CHF',
  IN: 'INR',
  CN: 'CNY',
  SE: 'SEK',
};

export function localeCurrency(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  let region: string;
  try {
    region = new Intl.Locale(locale).maximize().region as string;
  } catch {
    return undefined;
  }
  return EURO_REGIONS.has(region) ? 'EUR' : REGION_CURRENCY[region];
}
