// A token the api stops accepting (each product's docs/specs/015-api/mcp-server.md §3, "A token the api stops
// accepting"). `/mcp` lets any Bearer through, since only the api can tell whether liveworkspace still knows it, and a
// tool turns the api's 401 into a tool error inside an HTTP 200. A client then never learns its token is dead, and
// reconnecting reuses it. So the request watches the api's answers, and one 401 turns the whole response into the
// OAuth challenge that starts the connect flow again. Watching adds no call: it reads answers the tools asked for.

// The api's answer to a credential it does not accept (an unknown, revoked or expired token).
const REFUSED = 401;

/**
 * `env` with its `API` binding watched for a 401, and whether one came back. An env without an `API` binding (a
 * test, a product with no api) is handed back as it is and never reads as refused.
 */
export function watchTokenRefusal<E extends object>(env: E): { env: E; refused: () => boolean } {
  const api = (env as { API?: Fetcher }).API;
  if (!api || typeof api.fetch !== 'function') return { env, refused: () => false };
  let refused = false;
  const watched: Fetcher = {
    fetch: async (...args: Parameters<Fetcher['fetch']>) => {
      const response = await api.fetch(...args);
      if (response.status === REFUSED) refused = true;
      return response;
    },
    connect: (...args: Parameters<Fetcher['connect']>) => api.connect(...args),
  };
  return { env: { ...env, API: watched }, refused: () => refused };
}

/** The challenge for a missing or refused token, pointing the client at this server's resource metadata. */
export function bearerChallenge(origin: string, refused: boolean): string {
  const metadata = `resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  return refused ? `Bearer error="invalid_token", ${metadata}` : `Bearer ${metadata}`;
}
