// Two small request-reading rules the api and mcp workers both apply. Each
// worker used to spell them out inline, and the copies drifted: the api took
// the bearer token without trimming it (so "Bearer  tok" failed there and
// passed on mcp), only the api's CORS check knew `[::1]` is loopback, so
// the mcp's OAuth redirect_uri check refused a local IPv6 client, and only the
// api's redirect check refused a fragment.

// The token from an `Authorization: Bearer <token>` header, trimmed, or null
// when the header is absent, uses another scheme, or carries an empty token.
export function bearerTokenOf(authorization: string | null | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// Loopback hostnames as `new URL(...).hostname` returns them. IPv6 keeps its
// brackets there (`new URL('http://[::1]:3100').hostname === '[::1]'`), so the
// literal stays bracketed.
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

// Where an OAuth flow may send a browser back with a code: https anywhere, or plain http on a loopback host (a
// local client), and never with a fragment (RFC 6749 §3.1.2; checked on the raw string, since `new URL` drops a
// bare `#`). The scheme is checked on its own: a loopback host must never let another scheme through, or
// `javascript://localhost/...` would run as script on the page that navigates there. The URL, or null.
export function oauthRedirectUrl(uri: string): URL | null {
  if (uri.includes('#')) return null;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol === 'https:') return url;
  return url.protocol === 'http:' && isLoopbackHostname(url.hostname) ? url : null;
}

// A Clerk user id, the shape that is never a legitimate GUEST header.
//
// The guest credential is always a server-minted UUID (POST /api/guest-id).
// A Clerk `sub` in `X-Owner-Id` is therefore a replay of a harvested account
// id (team member lists expose them), and the api worker refuses it outright
// (apps/api/src/index.ts). The editor applies the same rule from the other
// side: a signed-in client with no session token never sends its account id
// as the guest header (apps/live/lib/api/core.ts `apiHeaders`).
export function isClerkIdShape(ownerId: string): boolean {
  return ownerId.startsWith('user_');
}
