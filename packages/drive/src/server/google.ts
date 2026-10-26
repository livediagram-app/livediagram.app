// Where Google is, and the one way a call to it fails (liveworkspace/docs/specs/005-drive/drive.md "Tokens"). Tests point every
// call at the fake Google (`@liveworkspace/fake-google`) with one base URL.

import { GOOGLE_CALL_TIMEOUT_MS } from '../constants';

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  // OAuth and Drive from one host, for the fake Google; unset in production.
  baseUrl?: string;
  fetch?: typeof fetch;
};

const OAUTH_ORIGIN = 'https://oauth2.googleapis.com';
const API_ORIGIN = 'https://www.googleapis.com';

// A loop, not /\/+$/: that pattern backtracks on every run of slashes.
function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) end--;
  return value.slice(0, end);
}

export const googleOAuthBase = (c: Pick<GoogleConfig, 'baseUrl'>) =>
  withoutTrailingSlashes(c.baseUrl || OAUTH_ORIGIN);
export const googleApiBase = (c: Pick<GoogleConfig, 'baseUrl'>) => withoutTrailingSlashes(c.baseUrl || API_ORIGIN);

/** A fetch that gives up after GOOGLE_CALL_TIMEOUT_MS, as a network failure would. */
export function timedFetch(c: Pick<GoogleConfig, 'fetch'>): typeof fetch {
  const f = c.fetch ?? fetch;
  return (input, init) => f(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(GOOGLE_CALL_TIMEOUT_MS) });
}
