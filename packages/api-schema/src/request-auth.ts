// Two small request-reading rules the api and mcp workers both apply. Each
// worker used to spell them out inline, and the copies drifted: the api took
// the bearer token without trimming it (so "Bearer  tok" failed there and
// passed on mcp), and only the api's CORS check knew `[::1]` is loopback, so
// the mcp's OAuth redirect_uri check refused a local IPv6 client.

// The token from an `Authorization: Bearer <token>` header, trimmed, or null
// when the header is absent, uses another scheme, or carries an empty token.
export function bearerTokenOf(authorization: string | null | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// Loopback hostnames as `new URL(...).hostname` returns them. IPv6 keeps its
// brackets there (`new URL('http://[::1]:3000').hostname === '[::1]'`), so the
// literal stays bracketed.
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
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
