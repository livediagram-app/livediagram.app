// The one MCP's request handling (liveworkspace/docs/specs/021-mcp/mcp.md), apart from how it reaches each app, so
// the tests can hand it stubs: what the token may reach and whether every tool is listed (`?tools=all`), the apps' old
// addresses (old-hosts.ts), and any app's refusal of the token turned into the sign-in challenge.
import { MCP_EXPOSED_HEADERS, createMcpApp } from '@liveworkspace/mcp-kit/app';
import { bearerChallenge } from '@liveworkspace/mcp-kit/token-refusal';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import type { Env } from './env';
import { allowedApps, narrowedApps } from './grants';
import { LISTING } from './listing';
import { OAUTH } from './oauth';
import { movedChallenge, oldHostApp, oldHostSignIn } from './old-hosts';
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
      let granted: Awaited<ReturnType<typeof allowedApps>> = [];
      try {
        if (token) granted = await allowedApps(env.OAUTH_KV, token);
      } catch (err) {
        // The person's ticks can't be read: answering with every app would ignore them, so the client tries again.
        console.error('[mcp] grant unreadable', { err });
        return withCors(
          Response.json(
            {
              error: 'temporarily_unavailable',
              error_description:
                'Couldn’t check which apps this connection may use. Try again in a moment.',
            },
            { status: 503, headers: { 'Retry-After': '5' } },
          ),
        );
      }
      const state: RequestState = {
        token,
        // An old address is that one app with every tool.
        allowed: token ? narrowedApps(granted, oldApp) : [],
        all: oldApp !== null || url.searchParams.get('tools') === 'all',
        refused: false,
      };
      const response = await app.fetch(request, { ...routed, REQUEST: state }, ctx);
      if (!state.refused) return response;
      if (oldApp) return withCors(movedChallenge(url));
      console.warn('[mcp] token refused by an app: asking the client to sign in again');
      return withCors(
        Response.json(
          {
            error: 'invalid_token',
            error_description:
              'This token is no longer accepted (revoked or expired). Sign in again.',
          },
          { status: 401, headers: { 'WWW-Authenticate': bearerChallenge(url.origin, true) } },
        ),
      );
    },
  };
}
