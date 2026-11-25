// The one MCP's consent (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app consent"): which MCP this
// site's page talks to, what the connection request is, and the hand-over: mint an account token for the client,
// give it and the ticked apps to the MCP, retire the client's earlier token, and send the browser on.
import { ONE_MCP_ORIGIN } from '@liveworkspace/api-schema/mcp-origin';
import { appSchemeRedirectUrl } from '@liveworkspace/api-kit/oauth';
import { accountApi } from './account-api';
import type { DeviceSessionClient } from './mcp-device-session';

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
  return ONE_MCP_ORIGIN;
}

export type ConsentSession = {
  clientName: string;
  redirectHost: string;
  verified: boolean;
  // An app's own CLI (a built-in client, `<app>-cli`): it calls one app's api, so it is offered no app list.
  cli: boolean;
  // The app scheme the sign-in goes back to (`cursor`) when it goes to an app on this computer, not a website: the
  // page warns that any app here can claim it (mcp.md "Redirect addresses"). Null for a web address.
  localScheme: string | null;
};

/** A scheme name as the MCP sends it, or null: never trusted to be more than a short run of scheme characters. */
function schemeName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  // The whole value must be the scheme the URL reads: `cursor:evil` reads as `cursor` and is refused.
  return appSchemeRedirectUrl(`${value}:x`)?.protocol === `${value}:` ? value : null;
}

/** Whether a client is one of the apps' CLIs, as the one MCP's built-in clients name them. */
export function isCliClient(clientId: unknown, verified: boolean): boolean {
  return (
    verified && typeof clientId === 'string' && MCP_APPS.some((a) => clientId === `${a.app}-cli`)
  );
}

/** The connection request the MCP holds, or null when it has expired (or never was). */
export async function fetchConsentSession(
  origin: string,
  session: string,
): Promise<ConsentSession | null> {
  try {
    const response = await fetch(`${origin}/oauth/session/${encodeURIComponent(session)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<ConsentSession> & { clientId?: unknown };
    const verified = body.verified === true;
    return {
      clientName:
        typeof body.clientName === 'string' && body.clientName ? body.clientName : 'An app',
      redirectHost: typeof body.redirectHost === 'string' ? body.redirectHost : '',
      verified,
      cli: isCliClient(body.clientId, verified),
      localScheme: schemeName((body as { localScheme?: unknown }).localScheme),
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
  // A read-only token: the AI tool finds and reads, every app refusing a change.
  readOnly = false,
): Promise<HandOver> {
  if (!(await fetchConsentSession(origin, session))) return { ok: false, reason: 'expired' };
  const minted = await accountApi<{ id: string; secret: string; expiresAt: number }>(
    '/tokens',
    'POST',
    { name: clientName, readOnly },
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

/**
 * Cancel (mcp.md "Sign-in and per-app consent"): the MCP forgets the request and answers where to send the browser,
 * the client's redirect address with `error=access_denied`, so the AI tool stops waiting. Null when the request has
 * expired or the MCP can't be reached: the page then just says the connection was cancelled.
 */
export async function cancelConnect(origin: string, session: string): Promise<string | null> {
  try {
    const response = await fetch(`${origin}/oauth/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
    });
    if (!response.ok) return null;
    const { redirectTo } = (await response.json()) as { redirectTo?: unknown };
    return safeRedirect(redirectTo) ? (redirectTo as string) : null;
  } catch {
    return null;
  }
}

// Where the browser may be sent: a web address, or an app's own scheme the client registered (`cursor://…`), never
// one a browser would run itself (`javascript:`, `data:`).
export function safeRedirect(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || appSchemeRedirectUrl(url) !== null;
  } catch {
    return false;
  }
}

/** Whether the browser is being handed to an app on this computer rather than a website: the page then stays. */
export function opensApp(url: string): boolean {
  return appSchemeRedirectUrl(url) !== null;
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
      return 'This request expired. Start again from your AI tool.';
    case 'token_limit':
      return 'You have 20 API Tokens, the most allowed. Revoke one below to connect.';
    default:
      return 'Couldn’t connect. Start again from your AI tool.';
  }
}

/**
 * A terminal's device sign-in, after Connect (mcp.md "The app MCPs fold in"): the code still waiting, an account token
 * minted for the CLI, handed to the MCP for the terminal to collect. A token the MCP did not take is revoked, so a
 * failed Connect never leaves one behind.
 */
export async function connectDevice(
  device: Pick<DeviceSessionClient, 'fetchSession' | 'complete'>,
  userCode: string,
  clientName: string,
  readOnly: boolean,
): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'token_limit' | 'failed' }> {
  const lookup = await device.fetchSession(userCode);
  if (lookup.kind !== 'found')
    return { ok: false, reason: lookup.kind === 'unknown' ? 'expired' : 'failed' };
  const minted = await accountApi<{ id: string; secret: string; expiresAt: number }>(
    '/tokens',
    'POST',
    { name: clientName, readOnly },
  );
  if (!minted.ok) return { ok: false, reason: minted.status === 409 ? 'token_limit' : 'failed' };
  const { id, secret, expiresAt } = minted.data;
  if (await device.complete(userCode, secret, expiresAt)) return { ok: true };
  await accountApi(`/tokens/${encodeURIComponent(id)}`, 'DELETE');
  return { ok: false, reason: 'failed' };
}
