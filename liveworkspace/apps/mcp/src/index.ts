// liveworkspace's one MCP (liveworkspace/docs/specs/021-mcp/mcp.md): a thin router in front of each app's MCP
// Worker. mcp-kit serves the transport, CORS, the server card and OAuth; this entry reads, per request, what the
// token may reach and whether every tool is listed (`?tools=all`), and turns any app's refusal of the token into the
// sign-in challenge.
import { createMcpApp } from '@liveworkspace/mcp-kit/app';
import { bearerChallenge } from '@liveworkspace/mcp-kit/token-refusal';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import type { Env } from './env';
import { allowedApps } from './grants';
import { LISTING } from './listing';
import { OAUTH } from './oauth';
import { buildServer, type RequestEnv, type RequestState } from './server';

export type { Env };

const app = createMcpApp<RequestEnv>({ buildServer, oauth: OAUTH, listing: LISTING });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp') return app.fetch(request, env, ctx);
    const token = bearerTokenOf(request.headers.get('Authorization'));
    const state: RequestState = {
      token,
      allowed: token ? await allowedApps(env.OAUTH_KV, token) : [],
      all: url.searchParams.get('tools') === 'all',
      refused: false,
    };
    const response = await app.fetch(request, { ...env, REQUEST: state }, ctx);
    if (!state.refused) return response;
    console.warn('[mcp] token refused by an app: asking the client to sign in again');
    return Response.json(
      {
        error: 'invalid_token',
        error_description: 'This token is no longer accepted (revoked or expired). Sign in again.',
      },
      { status: 401, headers: { 'WWW-Authenticate': bearerChallenge(url.origin, true) } },
    );
  },
} satisfies ExportedHandler<Env>;
