// The move to www. (liveworkspace/docs/specs/010-site/site.md "www. is the address", liveworkspace/docs/accounts.md "The move to
// www."). Every product and the platform live on their www. host, APIs included, and every URL we generate names it.
// The bare domains only redirect page loads; for a transition window a bare name (an issuer, an audience, an origin, a
// host a CLI file recorded) is still the same as its www. twin, so nothing minted or saved before the move breaks.
// Kept dependency-free and Worker-safe.

/** liveworkspace.app's address. */
export const WORKSPACE_WWW_ORIGIN = 'https://www.liveworkspace.app';

/** The accounts Worker's issuer: where its discovery documents and key set live, and every token's `iss`. */
export const ACCOUNTS_ISSUER = `${WORKSPACE_WWW_ORIGIN}/api/auth`;

/**
 * The transition window. While these domains are listed, a URL on one's bare host and the same URL on its www. host
 * are one name: token checks accept either issuer and audience, origin checks either origin.
 *
 * Drop a domain (and then the bare API routes) no earlier than `keepUntil`. The longest-lived credential naming a bare
 * host is a guest token (a year, liveworkspace/apps/accounts GUEST_TOKEN_TTL_SECONDS), so it is at least a year after
 * the accounts Worker first deployed with its issuer on www., with a month's margin. Refresh tokens (30 days), access
 * tokens (an hour) and API tokens (opaque, no host) are inside that. The bare domains' page redirects stay after it.
 */
export const BARE_WWW_TRANSITION = {
  domains: [
    'liveworkspace.app',
    'livediagram.app',
    'liveplanner.app',
    'livedocuments.app',
    'livedesign.app',
  ] as readonly string[],
  keepUntil: '2027-12-01',
} as const;

const DOMAINS: ReadonlySet<string> = new Set(BARE_WWW_TRANSITION.domains);

/** The bare and www. origins of a domain in the transition. */
export function bareAndWwwOrigins(domain: string): [bare: string, www: string] {
  return [`https://${domain}`, `https://www.${domain}`];
}

// `https://` then the host, up to the end, a path, a query or a fragment. No port, no other scheme: staging, local and
// stand-in addresses have no twin.
const HTTPS_HOST = /^https:\/\/([^/?#:@]+)(?=$|[/?#])/i;

/** The same URL on the other host of its domain (`https://liveworkspace.app/api/auth` ↔
 *  `https://www.liveworkspace.app/api/auth`), byte for byte otherwise; null for a URL on any other host. */
export function wwwTwin(url: string): string | null {
  const match = HTTPS_HOST.exec(url);
  if (!match) return null;
  const host = match[1]!.toLowerCase();
  const rest = url.slice(match[0].length);
  if (DOMAINS.has(host)) return `https://www.${host}${rest}`;
  if (host.startsWith('www.') && DOMAINS.has(host.slice(4)))
    return `https://${host.slice(4)}${rest}`;
  return null;
}

/** `url` and its twin, when it has one: what a check accepts in the transition. */
export function withWwwTwin(url: string): string[] {
  const twin = wwwTwin(url);
  return twin ? [url, twin] : [url];
}

/** Whether two origins (or URLs) name the same site: equal origins, or one the other's twin. */
export function sameSiteOrigin(a: string, b: string): boolean {
  let left: string;
  let right: string;
  try {
    left = new URL(a).origin;
    right = new URL(b).origin;
  } catch {
    return false;
  }
  return left === right || wwwTwin(left) === right;
}
