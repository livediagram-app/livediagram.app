// Origin of the MCP the Connect view shows people: liveworkspace's one MCP (liveworkspace/docs/specs/021-mcp/mcp.md).
// Staging and local dev override it at build time; the resolver is shared with the marketing site's Build with AI
// page (@liveknowledge/api-schema, mcp-origin.ts).

import { resolveMcpOrigin } from '@liveknowledge/api-schema';

export const MCP_ORIGIN = resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN);
