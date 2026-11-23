// The currency a visitor is shown (subscription.md "Price"): from the country Cloudflare saw the request come from,
// GBP when it names none. Development and staging also take `?currency=`, so each currency can be looked at.

import { currencyForCountry, isCurrency, type Currency } from '@liveworkspace/subscription';
import { environmentOf, type Env } from './env';

export function currencyOf(request: Request, env: Env, url: URL): Currency {
  if (environmentOf(env) !== 'production') {
    const asked = url.searchParams.get('currency')?.trim().toUpperCase();
    if (isCurrency(asked)) return asked;
  }
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return currencyForCountry(typeof country === 'string' ? country : null);
}
