import type { Metadata } from 'next';

// What the sign-in, registration and consent pages share: kept out of search, and no Referer, since
// the address carries an app's signed OAuth request.
export const ACCOUNT_PAGE_METADATA: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
  openGraph: null,
};
