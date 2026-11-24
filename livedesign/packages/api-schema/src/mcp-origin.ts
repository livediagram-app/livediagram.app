// Origin of the MCP people connect for livedesign: liveworkspace's one MCP (liveworkspace/docs/specs/021-mcp/mcp.md),
// since livedesign's own public MCP is retired ("The app MCPs fold in"). The resolver every app reads it through is
// liveworkspace's (@liveworkspace/api-schema/mcp-origin), bound to it here. Staging is
// https://mcp-staging.liveworkspace.app, local development http://localhost:3013.
import { createMcpOriginResolver } from '@liveworkspace/api-schema/mcp-origin';

export const DEFAULT_MCP_ORIGIN = 'https://mcp.liveworkspace.app';

// The build-time NEXT_PUBLIC_MCP_ORIGIN, or the hosted default when it is unset or blank.
export const resolveMcpOrigin = /* @__PURE__ */ createMcpOriginResolver(DEFAULT_MCP_ORIGIN);

export { mcpEndpoint } from '@liveworkspace/api-schema/mcp-origin';
