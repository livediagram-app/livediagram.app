// Origin of livedesign's MCP worker (docs/specs/015-api/mcp-server.md): the hosted one, and the resolver every app
// reads it through (liveworkspace's, @liveworkspace/api-schema/mcp-origin, bound to it here).
import { createMcpOriginResolver } from '@liveworkspace/api-schema/mcp-origin';

export const DEFAULT_MCP_ORIGIN = 'https://mcp.livedesign.app';

// The build-time NEXT_PUBLIC_MCP_ORIGIN, or the hosted default when it is unset or blank.
export const resolveMcpOrigin = /* @__PURE__ */ createMcpOriginResolver(DEFAULT_MCP_ORIGIN);

export { mcpEndpoint } from '@liveworkspace/api-schema/mcp-origin';
