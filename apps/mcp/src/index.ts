// livediagram MCP server (spec/62) — a standalone Cloudflare Worker fronted by
// Hono. POST /mcp carries the Streamable-HTTP MCP transport (stateless, JSON
// responses), Bearer-gated; tools reach the api worker over the API service
// binding, forwarding the caller's `Authorization: Bearer lvd_…`. OAuth 2.1
// endpoints mount alongside (added in the OAuth step).
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { buildServer } from './server';
import { registerOauthRoutes } from './oauth';

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

// OAuth 2.1 discovery / register / authorize / complete / token (spec/62 §3).
registerOauthRoutes(app);

// The MCP Streamable-HTTP transport. Stateless (no session id) with JSON
// responses, which suits a per-request Worker: build a fresh server + transport,
// connect, and let the transport turn the request into a response.
app.all('/mcp', async (c) => {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (!token) {
    // Point MCP clients at the OAuth resource metadata so they can start the
    // connect flow (the metadata endpoint lands with the OAuth step).
    return c.json({ error: 'unauthorized' }, 401, {
      'WWW-Authenticate':
        'Bearer resource_metadata="https://mcp.livediagram.app/.well-known/oauth-protected-resource"',
    });
  }
  const server = buildServer(c.env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw, {
    authInfo: { token, clientId: 'mcp', scopes: [] },
  });
});

export default app;
