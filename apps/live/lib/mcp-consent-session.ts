// What the MCP consent screen is allowed to believe about an authorize
// request (spec/62 §3).
//
// The MCP's /oauth/authorize redirects here with `session`, and ALSO with
// `client` + `to` query params for display. Those params are not evidence:
// anyone can write a consent URL by hand around a session id, so a screen that
// renders them will happily tell the victim that a full-access token is going
// somewhere it isn't. `GET /oauth/session/<id>` answers the same two questions
// from the server's own record of the request, where the redirect URI was
// checked against the client's registered list before the session was stored.
//
// Lives in lib/ beside mcp-config.ts (which owns the trusted origin this is
// fetched from) rather than in the page: it is the page's trust boundary, and
// it is worth being able to test the parse without mounting React.

import { MCP_ORIGIN } from './mcp-config';

// The server's account of the connecting client. `redirectHost` is the host
// the authorization code will actually be delivered to — the one fact the
// screen needs the user to recognise.
export type McpConsentSession = {
  clientName: string;
  redirectHost: string;
};

// Narrow an untrusted JSON body to the shape above. The response comes from a
// trusted origin, but it still crosses a network boundary, so a missing or
// wrongly-typed field must read as "couldn't resolve" rather than render as
// `undefined` in a sentence about where access is going.
export function parseConsentSession(body: unknown): McpConsentSession | null {
  if (typeof body !== 'object' || body === null) return null;
  const { clientName, redirectHost } = body as Record<string, unknown>;
  if (typeof clientName !== 'string' || typeof redirectHost !== 'string') return null;
  // A blank name is the server's own fallback ('MCP client'), so an empty one
  // means something is wrong upstream; a blank HOST is tolerated because
  // /oauth/session reports it blank for an unparseable redirect URI.
  if (clientName.length === 0) return null;
  return { clientName, redirectHost };
}

// Fetch the session, or null when it's expired / unknown / unreachable. One
// null for every failure: the screen's answer is the same in each case (the
// user restarts the connection from their app), and distinguishing them would
// only invite rendering a half-trusted screen.
export async function fetchConsentSession(session: string): Promise<McpConsentSession | null> {
  try {
    const res = await fetch(`${MCP_ORIGIN}/oauth/session/${encodeURIComponent(session)}`);
    if (!res.ok) return null;
    return parseConsentSession(await res.json());
  } catch {
    return null;
  }
}
