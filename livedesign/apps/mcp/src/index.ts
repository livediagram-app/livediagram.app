// livedesign's MCP (docs/specs/015-api/mcp-server.md): its tools, prompts and resources, as a package. It is not a Worker
// of its own: liveworkspace's one MCP (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in") runs it in
// process, handing it an env with livedesign's api binding, and signs people in itself. POST /mcp carries the
// Streamable-HTTP MCP transport (stateless, JSON responses), Bearer-gated; tools reach the api over the API binding,
// forwarding the caller's `Authorization: Bearer lwt_…`.
import { createMcpApp } from '@liveworkspace/mcp-kit/app';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { LISTING } from './listing';
import { buildServer } from './server';

export type { Env };

// The transport, CORS and health check are @liveworkspace/mcp-kit's; this product hands in its server (tools,
// prompts, resources). No authorization server: the one MCP is the only place anyone signs in.
const app = createMcpApp<Env>({ buildServer, listing: LISTING });

export default app;
