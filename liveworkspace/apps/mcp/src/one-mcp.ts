// The one MCP's request handling (liveworkspace/docs/specs/021-mcp/mcp.md), apart from how it reaches each app, so
// the tests can hand it stubs: the client's token resolved to the account token behind it (bearer.ts) before
// anything runs, what that may reach and whether every tool is listed (`?tools=all`), the apps' old addresses
// (old-hosts.ts), and any app's refusal of the token turned into the sign-in challenge.
import { MCP_EXPOSED_HEADERS, createMcpApp, urlCarriesToken } from '@liveworkspace/mcp-kit/app';
import { revokeSignIn } from '@liveworkspace/mcp-kit/oauth-tokens';
import { bearerChallenge } from '@liveworkspace/mcp-kit/token-refusal';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import { resolveBearer, type Resolved } from './bearer';
import type { Env } from './env';
import { GrantUnreadable, allowedApps } from './grants';
import { LISTING } from './listing';
import { OAUTH } from './oauth';
import { movedChallenge, oldHostApp, oldHostMcp, oldHostSignIn } from './old-hosts';
import { buildServer, type RequestEnv, type RequestState } from './server';

const app = createMcpApp<RequestEnv>({ buildServer, oauth: OAUTH, listing: LISTING });

/**
 * An answer made here rather than by mcp-kit's app, with the CORS headers that app gives every answer: without them a
 * client in a page can read neither a refused token's 401 nor an old address's pointer, and never signs in again.
 */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', MCP_EXPOSED_HEADERS.join(', '));
  return new Response(response.body, { status: response.status, headers });
}

/** The 401 for a token this server won't take: `invalid_token`, words, and the challenge to sign in again. */
export function refusedToken(url: URL, description: string): Response {
  return withCors(
    Response.json(
      { error: 'invalid_token', error_description: description },
      { status: 401, headers: { 'WWW-Authenticate': bearerChallenge(url.origin, true) } },
    ),
  );
}

/**
 * The request as it goes on inside this Worker: the account token in place of the client's, so nothing past here
 * (mcp-kit's app, a handshake's remembered client name, each app's package) ever sees the client's own token.
 */
function withAccountToken(request: Request, upstream: string): Request {
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${upstream}`);
  return new Request(request, { headers });
}

/** The Worker, given how it reaches each app: the packages in production, stubs in tests. */
export function oneMcp<E extends { OAUTH_KV: KVNamespace }>(
  envFor: (env: E, ctx: ExecutionContext) => Env,
  packages?: (request: Request, env: E, ctx: ExecutionContext) => Promise<Response> | null,
) {
  return {
    async fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response> {
      const direct = packages?.(request, env, ctx);
      if (direct) return direct;
      const url = new URL(request.url);
      const oldApp = oldHostApp(url.hostname);
      // A preflight carries no token and asks only for the CORS headers, which mcp-kit's app answers.
      const preflight = request.method === 'OPTIONS';
      if (oldApp && !preflight) {
        const signIn = oldHostSignIn(request, url);
        if (signIn) return withCors(signIn);
      }
      const routed = envFor(env, ctx);
      if (url.pathname !== '/mcp') return app.fetch(request, routed, ctx);
      const token = bearerTokenOf(request.headers.get('Authorization'));
      // Nobody signs in at an old address: no token there is the pointer, not a sign-in challenge.
      if (oldApp && !token && !preflight) return withCors(movedChallenge(url));
      // No token, a preflight, or a token in the address: mcp-kit's challenge, CORS or refusal, and nothing runs.
      if (!token || preflight || urlCarriesToken(request.url))
        return app.fetch(request, { ...routed, REQUEST: emptyState(url) }, ctx);
      // The client's token is checked before anything runs, `initialize` and `tools/list` too, and never goes on.
      let resolved: Resolved;
      try {
        resolved = await resolveBearer(routed, token, url.origin);
      } catch (err) {
        // The token store couldn't be read: no guess either way, the client tries again.
        console.error('[mcp] token unreadable', { err: String(err) });
        return unavailable('Couldn’t check this connection’s token. Try again in a moment.');
      }
      if (!resolved.ok)
        return oldApp ? withCors(movedChallenge(url)) : refusedToken(url, resolved.description);
      const upstream = resolved.upstream;
      const inner = withAccountToken(request, upstream);
      try {
        // An old address is that app's own MCP, as it was before the fold.
        if (oldApp) {
          const passed = await oldHostMcp(inner, url, oldApp, upstream, routed);
          return passed.status === 401 ? withCors(passed) : passed;
        }
        const state: RequestState = {
          token: upstream,
          allowed: await allowedApps(env.OAUTH_KV, upstream),
          all: url.searchParams.get('tools') === 'all',
          refused: false,
        };
        const response = await app.fetch(inner, { ...routed, REQUEST: state }, ctx);
        if (!state.refused) return response;
      } catch (err) {
        if (!(err instanceof GrantUnreadable)) throw err;
        // The person's ticks can't be read: answering with every app would ignore them, so the client tries again.
        console.error('[mcp] grant unreadable', { err: err.cause });
        return unavailable(
          'Couldn’t check which apps this connection may use. Try again in a moment.',
        );
      }
      console.warn('[mcp] token refused by an app: asking the client to sign in again');
      // The account token behind this sign-in is dead, so its refresh token stops too: the client signs in again
      // rather than refreshing into the same refusal.
      if (resolved.family) await revokeSignIn(env.OAUTH_KV, resolved.family);
      return refusedToken(
        url,
        'This token is no longer accepted (revoked or expired). Sign in again.',
      );
    },
  };
}

function unavailable(description: string): Response {
  return withCors(
    Response.json(
      { error: 'temporarily_unavailable', error_description: description },
      { status: 503, headers: { 'Retry-After': '5' } },
    ),
  );
}

function emptyState(url: URL): RequestState {
  return { token: null, allowed: [], all: url.searchParams.get('tools') === 'all', refused: false };
}
