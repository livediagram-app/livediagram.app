// The one MCP's request handling (liveworkspace/docs/specs/021-mcp/mcp.md), apart from how it reaches each app, so
// the tests can hand it stubs: what the token may reach and whether every tool is listed (`?tools=all`), the apps' old
// addresses (old-hosts.ts), and any app's refusal of the token turned into the sign-in challenge.
import { createMcpApp } from '@liveworkspace/mcp-kit/app';
import { bearerChallenge } from '@liveworkspace/mcp-kit/token-refusal';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import type { Env } from './env';
import { allowedApps } from './grants';
import { LISTING } from './listing';
import { OAUTH } from './oauth';
import { movedChallenge, oldHostApp, oldHostMcp, oldHostSignIn } from './old-hosts';
import { buildServer, type RequestEnv, type RequestState } from './server';

const app = createMcpApp<RequestEnv>({ buildServer, oauth: OAUTH, listing: LISTING });

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
      if (oldApp) {
        const signIn = oldHostSignIn(request, url);
        if (signIn) return signIn;
      }
      const routed = envFor(env, ctx);
      if (url.pathname !== '/mcp') return app.fetch(request, routed, ctx);
      const token = bearerTokenOf(request.headers.get('Authorization'));
      // Nobody signs in at an old address: no token there is the pointer, not a sign-in challenge.
      if (oldApp && !token) return movedChallenge(url);
      // An old address is that app's own MCP, as it was before the fold.
      if (oldApp && token) return oldHostMcp(request, url, oldApp, token, routed);
      const state: RequestState = {
        token,
        allowed: token ? await allowedApps(env.OAUTH_KV, token) : [],
        all: url.searchParams.get('tools') === 'all',
        refused: false,
      };
      const response = await app.fetch(request, { ...routed, REQUEST: state }, ctx);
      if (!state.refused) return response;
      console.warn('[mcp] token refused by an app: asking the client to sign in again');
      return Response.json(
        {
          error: 'invalid_token',
          error_description:
            'This token is no longer accepted (revoked or expired). Sign in again.',
        },
        { status: 401, headers: { 'WWW-Authenticate': bearerChallenge(url.origin, true) } },
      );
    },
  };
}
