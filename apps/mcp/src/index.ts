// livediagram MCP server (spec/62) — a standalone Cloudflare Worker fronted by
// Hono. The Streamable-HTTP MCP transport + tools mount on POST /mcp (added in
// the tools phase); the OAuth 2.1 endpoints mount alongside. Every tool reaches
// the api worker over the API service binding, forwarding the caller's
// `Authorization: Bearer lvd_…` token.
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Worker bindings (wrangler.toml).
export type Env = {
  // Service binding to livediagram-api — tools forward to /api/* through it.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
};

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

// Liveness probe (spec/62 §2).
app.get('/health', (c) => c.json({ status: 'ok' }));

// The MCP transport mounts here in the tools phase (spec/62 §4), Bearer-gated.
app.post('/mcp', (c) => c.json({ error: 'not_implemented' }, 501));

export default app;
