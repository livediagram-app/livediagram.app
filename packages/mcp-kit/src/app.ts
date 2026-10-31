// A product's MCP server as a Worker (each product's docs/specs/015-api/mcp-server.md), fronted by Hono. POST /mcp
// carries the Streamable-HTTP MCP transport (stateless, JSON responses), Bearer-gated; the product's tools reach
// its api Worker, forwarding the caller's `Authorization: Bearer lwt_…`. The OAuth 2.1 endpoints mount alongside.
// A product hands in only what is its own: the MCP server it builds per request (its tools, prompts and schema
// resource) and its authorization server's configuration.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { bearerTokenOf } from '@liveworkspace/api-kit/request-auth';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SERVER_CARD_PATH, serverCard, type McpListing } from './listing';
import { registerOauthRoutes, type OauthServer } from './oauth';
import type { OauthEnv } from './oauth-clients';
import { runInRequest } from './request-scope';

export function createMcpApp<E extends OauthEnv>(options: {
  // A fresh server per request: the caller's token arrives through the transport's authInfo and is read inside
  // each tool, so nothing carries over between requests.
  buildServer: (env: E) => McpServer;
  oauth: OauthServer<E>;
  // How the server is listed: its serverInfo, server.json and server card (mcp-server.md §4.16).
  listing: McpListing;
}): Hono<{ Bindings: E }> {
  const app = new Hono<{ Bindings: E }>();
  // The server card per origin (production, staging, local): what it lists only changes with a deploy, which
  // starts new isolates, so one build per isolate and origin serves every later request.
  const cards = new Map<string, Record<string, unknown>>();

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

  // The server card (mcp-server.md §4.16): what a directory or client shows before anyone signs in.
  app.get(SERVER_CARD_PATH, async (c) => {
    const origin = new URL(c.req.url).origin;
    let card = cards.get(origin);
    if (!card) {
      // A host header can name any origin, so the cache keeps a handful and starts again past that.
      if (cards.size >= MAX_CARD_ORIGINS) cards.clear();
      card = await serverCard(options.listing, options.buildServer(c.env), origin);
      cards.set(origin, card);
    }
    return c.json(card, 200, { 'Cache-Control': 'public, max-age=3600' });
  });

  // OAuth 2.1 discovery / register / authorize / complete / token (mcp-server.md §3).
  registerOauthRoutes(app, options.oauth);

  // The MCP Streamable-HTTP transport. Stateless (no session id) with JSON
  // responses, which suits a per-request Worker: build a fresh server + transport,
  // connect, and let the transport turn the request into a response.
  app.all('/mcp', async (c) => {
    const token = bearerTokenOf(c.req.header('Authorization'));
    if (!token) {
      // Point MCP clients at the OAuth resource metadata so they can start the
      // connect flow. The origin comes from the request, like every endpoint in
      // oauth.ts, so a staging or local worker sends clients to ITS metadata.
      const origin = new URL(c.req.url).origin;
      return c.json({ error: 'unauthorized' }, 401, {
        'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      });
    }
    const server = options.buildServer(c.env);
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

  return app;
}

const MAX_CARD_ORIGINS = 8;

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
