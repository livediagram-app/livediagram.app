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
