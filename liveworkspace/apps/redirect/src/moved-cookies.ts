// A session from before the move to www. (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."): its cookies were
// host-only on the bare domain, so www. never sees them. The redirect that sends a page load to www. moves them in the
// same hop: each is set again, same value, on `Domain=liveworkspace.app`. The values are copied as they are (accounts
// signed them, and the signature names no host), so nobody is signed out and no guest loses their things. The
// accounts Worker sets the same cookies on the domain from the move on.
//
// Nothing is cleared. Browsers differ on whether a host-only cookie and a domain cookie of one name and path are one
// cookie (RFC 6265 says yes, Chrome and Firefox keep both): where they are one, setting the domain copy replaces the
// old one, and a clear in the same answer would delete the copy just made. Where both stay, the bare domain sends both,
// with the same value, and accounts reads the first one signed with its secret (own-cookies.ts).

/** The domain the accounts Worker's production cookies live on (liveworkspace/apps/accounts cookie-scope.ts). */
export const COOKIE_DOMAIN = 'liveworkspace.app';

const SEVEN_DAYS = 7 * 24 * 60 * 60;
const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

/** The cookies that move, with the life each is set with on the domain (null: for the browser session, as Better
 *  Auth sets it). Production's Better Auth cookies carry the `__Secure-` prefix. */
export const MOVED_COOKIES: ReadonlyMap<string, number | null> = new Map([
  // Better Auth's own: the session (its 7-day expiresIn, refreshed as it is used) and "don't remember me".
  ['__Secure-better-auth.session_token', SEVEN_DAYS],
  ['__Secure-better-auth.dont_remember', null],
  // The guest (accounts guests.ts): set again on every hand-off, so a browser's cap on its life never drops it.
  ['lw_guest', TEN_YEARS],
]);

/** The Set-Cookie lines that move a request's old cookies to the domain: one per cookie found, none without one. A
 *  name the browser sends twice already has its domain copy, so it is left as it is. */
export function movedCookies(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  const found = new Map<string, string[]>();
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!MOVED_COOKIES.has(name)) continue;
    found.set(name, [...(found.get(name) ?? []), part.slice(eq + 1).trim()]);
  }
  const lines: string[] = [];
  for (const [name, values] of found) {
    const [value] = values;
    if (values.length !== 1 || !value) continue;
    const life = MOVED_COOKIES.get(name);
    const maxAge = typeof life === 'number' ? `; Max-Age=${life}` : '';
    lines.push(
      `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}${maxAge}`,
    );
  }
  return lines;
}
