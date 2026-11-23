// The one MCP's consent (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): which MCP this
// site's page talks to, what the connection request is, and the hand-over: mint an account token for the client,
// give it and the ticked apps to the MCP, retire the client's earlier token, and send the browser on.
import { accountApi } from './account-api';

/** The apps the one MCP reaches, as their site ids and MCP names (livehuddle has no MCP). */
export const MCP_APPS = [
  { site: 'livediagram.app', app: 'livediagram', makes: 'Diagrams' },
  { site: 'livedocuments.app', app: 'livedocuments', makes: 'Slide decks, articles, infographics' },
  { site: 'liveplanner.app', app: 'liveplanner', makes: 'Plans, boards, sheets, forms' },
  { site: 'livedesign.app', app: 'livedesign', makes: 'Designs' },
  { site: 'liveknowledge.app', app: 'liveknowledge', makes: 'Knowledgebases' },
] as const;

export type McpApp = (typeof MCP_APPS)[number]['app'];

/** The MCP this page trusts, from the page's own host, never from its address's query. */
export function mcpOrigin(location: { hostname: string; protocol: string }): string {
  if (location.hostname.startsWith('staging.')) return 'https://mcp-staging.liveworkspace.app';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    return 'http://localhost:3013';
  return 'https://mcp.liveworkspace.app';
}

export type ConsentSession = { clientName: string; redirectHost: string; verified: boolean };

/** The connection request the MCP holds, or null when it has expired (or never was). */
export async function fetchConsentSession(
  origin: string,
  session: string,
): Promise<ConsentSession | null> {
  try {
    const response = await fetch(`${origin}/oauth/session/${encodeURIComponent(session)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<ConsentSession>;
    return {
      clientName:
        typeof body.clientName === 'string' && body.clientName ? body.clientName : 'An app',
      redirectHost: typeof body.redirectHost === 'string' ? body.redirectHost : '',
      verified: body.verified === true,
    };
  } catch {
    return null;
  }
}

export type HandOver =
  { ok: true; redirectTo: string } | { ok: false; reason: 'expired' | 'token_limit' | 'failed' };

const REPLACES_MAX = 5;

/** The whole hand-over, after Connect. */
export async function connect(
  origin: string,
  session: string,
  clientName: string,
  apps: readonly McpApp[],
): Promise<HandOver> {
  if (!(await fetchConsentSession(origin, session))) return { ok: false, reason: 'expired' };
  const minted = await accountApi<{ id: string; secret: string; expiresAt: number }>(
    '/tokens',
    'POST',
    { name: clientName },
  );
  if (!minted.ok)
    return {
      ok: false,
      reason: minted.status === 409 ? 'token_limit' : 'failed',
    };
  const { id, secret, expiresAt } = minted.data;
  let done: { redirectTo: string; replaces?: unknown } | null = null;
  try {
    const response = await fetch(`${origin}/oauth/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, token: secret, expiresAt, tokenId: id, apps }),
    });
    if (response.ok) done = (await response.json()) as { redirectTo: string; replaces?: unknown };
  } catch {
    done = null;
  }
  if (!done || !safeRedirect(done.redirectTo)) {
    // The MCP never took it: the token goes, so nothing unused is left in the person's list.
    await accountApi(`/tokens/${encodeURIComponent(id)}`, 'DELETE');
    return { ok: false, reason: 'failed' };
  }
  await retireReplaced(id, clientName, done.replaces);
  return { ok: true, redirectTo: done.redirectTo };
}

function safeRedirect(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

// A reconnect replaces the client's earlier tokens: only ids the MCP named that are still live and carry this
// client's name, so a token made by hand, or another client's, is never touched. A failure leaves them be.
async function retireReplaced(newId: string, name: string, replaces: unknown): Promise<void> {
  if (!Array.isArray(replaces)) return;
  const ids = replaces
    .filter((r): r is string => typeof r === 'string' && r !== newId)
    .slice(0, REPLACES_MAX);
  if (ids.length === 0) return;
  const listed = await accountApi<{ tokens: { id: string; name: string }[] }>('/tokens');
  if (!listed.ok) return;
  const retiring = listed.data.tokens.filter((t) => ids.includes(t.id) && t.name === name);
  await Promise.all(
    retiring.map((t) => accountApi(`/tokens/${encodeURIComponent(t.id)}`, 'DELETE')),
  );
}

export function handOverError(reason: 'expired' | 'token_limit' | 'failed'): string {
  switch (reason) {
    case 'expired':
      return 'This request has expired. Start the connection again from your AI tool.';
    case 'token_limit':
      return 'Your account has 20 API tokens, the most it can hold. Remove one in Settings › API Tokens, then try again.';
    default:
      return 'Couldn’t finish connecting. Start the connection again from your AI tool.';
  }
}
