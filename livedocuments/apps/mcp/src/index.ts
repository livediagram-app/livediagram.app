// livedocuments MCP server (docs/specs/015-api/mcp-server.md) — a standalone Cloudflare Worker fronted by
// Hono. POST /mcp carries the Streamable-HTTP MCP transport (stateless, JSON
// responses), Bearer-gated; tools reach the api worker over the API service
// binding, forwarding the caller's `Authorization: Bearer lwt_…`. OAuth 2.1
// endpoints mount alongside.
import { createMcpApp } from '@liveworkspace/mcp-kit/app';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { OAUTH } from './oauth';
import { buildServer } from './server';

export type { Env };

// The transport, CORS, health check and OAuth endpoints are @liveworkspace/mcp-kit's; this product hands in its
// server (tools, prompts, the schema resource) and its authorization server's configuration (oauth.ts).
const app = createMcpApp<Env>({ buildServer, oauth: OAUTH });

export default app;
