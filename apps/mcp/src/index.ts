// livediagram MCP server (docs/specs/015-api/mcp-server.md) — a standalone Cloudflare Worker fronted by
// Hono. POST /mcp carries the Streamable-HTTP MCP transport (stateless, JSON
// responses), Bearer-gated; tools reach the api worker over the API service
// binding, forwarding the caller's `Authorization: Bearer lvd_…`. OAuth 2.1
// endpoints mount alongside (added in the OAuth step).
import { bearerTokenOf } from '@livediagram/api-schema';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { buildServer } from './server';
import { registerOauthRoutes } from './oauth';
import { runInRequest } from './request-scope';

export type { Env };

const app = new Hono<{ Bindings: Env }>();

// MCP clients call from arbitrary origins; the Bearer token is the
// authorization, not the origin, so CORS is permissive.
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
    exposeHeaders: ['Mcp-Session-Id'],
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

// OAuth 2.1 discovery / register / authorize / complete / token (docs/specs/015-api/mcp-server.md §3).
registerOauthRoutes(app);

// The MCP Streamable-HTTP transport. Stateless (no session id) with JSON
// responses, which suits a per-request Worker: build a fresh server + transport,
// connect, and let the transport turn the request into a response.
app.all('/mcp', async (c) => {
  const token = bearerTokenOf(c.req.header('Authorization'));
  if (!token) {
    // Point MCP clients at the OAuth resource metadata so they can start the
    // connect flow (the metadata endpoint lands with the OAuth step). The
    // origin comes from the request, like every endpoint in oauth.ts, so a
    // self-hosted worker sends clients to ITS metadata, not livediagram.app's.
    const origin = new URL(c.req.url).origin;
    return c.json({ error: 'unauthorized' }, 401, {
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    });
  }
  const server = buildServer(c.env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  // Tools post telemetry fire-and-forget; the request's waitUntil keeps those
  // posts alive past the response (request-scope.ts).
  return runInRequest(requestWaitUntil(c), () =>
    transport.handleRequest(c.req.raw, {
      authInfo: { token, clientId: 'mcp', scopes: [] },
    }),
  );
});

// Hono's `executionCtx` throws when the runtime supplied none (a unit test
// calling app.fetch without one), so read it defensively.
function requestWaitUntil(c: {
  readonly executionCtx: { waitUntil(promise: Promise<unknown>): void };
}): ((promise: Promise<unknown>) => void) | null {
  try {
    const ctx = c.executionCtx;
    return (promise) => ctx.waitUntil(promise);
  } catch {
    return null;
  }
}

export default app;
