// Renewing a guest token the page still holds (liveworkspace/docs/specs/003-accounts/accounts.md "Renewing without the
// cookie"). Safari can clear the accounts site's `lw_guest` cookie, so the page presents its token as proof of the
// guest. It never goes in a query string: the page leaves it in a short cookie on its own origin, scoped to its api's
// `/api/auth/guest`, and the api answers that visit with a page that posts it to the accounts site in a form body.
// The form is sent while that page is still loading, so it takes no history entry, as the plain hand-off takes none.

/** The page's own cookie carrying the token to its api's `/api/auth/guest`, for a minute at most. */
export const GUEST_RENEWAL_COOKIE = 'lw_guest_renewal';
export const GUEST_RENEWAL_COOKIE_PATH = '/api/auth/guest';
export const GUEST_RENEWAL_COOKIE_MAX_AGE_SECONDS = 60;
// A guest token is three base64url parts; anything else (or longer) is not one, and is never echoed into the page.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,2000}\.[A-Za-z0-9_-]{1,2000}\.[A-Za-z0-9_-]{0,2000}$/;

/** The token a renewal cookie carries, or null when it is not shaped like one. */
export function renewalToken(value: string | null): string | null {
  return value && TOKEN_SHAPE.test(value) ? value : null;
}

/** The cookie the page sets before it leaves for its api's guest door (`value`), or clears (`null`), on `path`. */
export function guestRenewalCookie(value: string | null, path = GUEST_RENEWAL_COOKIE_PATH): string {
  const maxAge = value === null ? 0 : GUEST_RENEWAL_COOKIE_MAX_AGE_SECONDS;
  return `${GUEST_RENEWAL_COOKIE}=${value ?? ''}; Path=${path}; Max-Age=${maxAge}; Secure; SameSite=Strict`;
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

/** The api's answer to a renewal: a page that posts `token` to the accounts site's hand-off `action` as it loads (a
 *  button without script), clearing the renewal cookie. No store, the origin alone as referrer, never framed. */
export function guestRenewalPage(action: string, token: string): Response {
  const nonce = randomNonce();
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>One moment</title></head><body><form id="renew" method="post" action="${escapeAttribute(action)}"><input type="hidden" name="guest_token" value="${escapeAttribute(token)}"><noscript><button type="submit">Continue</button></noscript></form><script nonce="${nonce}">document.getElementById('renew').submit();</script></body></html>`;
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    // Not no-referrer: a POST under no-referrer (or same-origin) sends `Origin: null`, and the accounts site takes a
    // proof only from the app's own origin. strict-origin sends no path, so the state never leaves in a Referer.
    'Referrer-Policy': 'strict-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
  });
  headers.append('Set-Cookie', guestRenewalCookie(null));
  return new Response(body, { status: 200, headers });
}
