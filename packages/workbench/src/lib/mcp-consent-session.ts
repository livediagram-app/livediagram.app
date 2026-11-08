// What the MCP consent screen is allowed to believe about an authorize request (docs/specs/015-api/mcp-server.md §3).
//
// The MCP's /oauth/authorize redirects to the consent page with `session`, and ALSO with `client` + `to` query params
// for display. Those params are not evidence: anyone can write a consent URL by hand around a session id, so a screen
// that renders them will happily tell the victim that a full-access token is going somewhere it isn't.
// `GET /oauth/session/<id>` answers from the server's own record of the request, where the redirect URI was checked
// against the client's registered list before the session was stored.
//
// The page's trust boundary, kept apart from the page so its parse is testable without mounting React. The origin is
// the editor's trusted MCP origin (its lib/mcp-config.ts), handed in, never one from the page URL.

// The server's account of the connecting client. `redirectHost` is the host the authorization code will actually be
// delivered to: the one fact the screen needs the user to recognise.
export type McpConsentSession = {
  clientName: string;
  redirectHost: string;
  // Public; read only to tell the CLI apart for telemetry (docs/specs/015-api/blueprints/cli.md CLI77).
  clientId: string | null;
  // A built-in client (the product's CLI). Every registered client is unverified: registration is open, so its
  // name is whatever it sent. Anything but `true` reads as unverified.
  verified: boolean;
};

// Narrow an untrusted JSON body to the shape above. The response comes from a trusted origin, but it still crosses
// a network boundary, so a missing or wrongly-typed field must read as "couldn't resolve" rather than render as
// `undefined` in a sentence about where access is going.
export function parseConsentSession(body: unknown): McpConsentSession | null {
  if (typeof body !== 'object' || body === null) return null;
  const { clientName, redirectHost, clientId, verified } = body as Record<string, unknown>;
  if (typeof clientName !== 'string' || typeof redirectHost !== 'string') return null;
  // A blank name is the server's own fallback ('MCP client'), so an empty one means something is wrong upstream; a
  // blank HOST is tolerated because /oauth/session reports it blank for an unparseable redirect URI.
  if (clientName.length === 0) return null;
  return {
    clientName,
    redirectHost,
    clientId: typeof clientId === 'string' ? clientId : null,
    verified: verified === true,
  };
}

// Fetch the session, or null when it's expired / unknown / unreachable. One null for every failure: the screen's
// answer is the same in each case (the user restarts the connection from their app), and distinguishing them would
// only invite rendering a half-trusted screen.
export async function fetchConsentSession(
  mcpOrigin: string,
  session: string,
): Promise<McpConsentSession | null> {
  try {
    const res = await fetch(`${mcpOrigin}/oauth/session/${encodeURIComponent(session)}`);
    if (!res.ok) return null;
    return parseConsentSession(await res.json());
  } catch {
    return null;
  }
}
