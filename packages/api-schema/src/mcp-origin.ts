// Origin of the MCP worker (docs/specs/015-api/mcp-server.md), shared by every app that names it: the live editor's
// OAuth consent pages and the marketing site's Build with AI page. Self-hosters override it at build time with
// NEXT_PUBLIC_MCP_ORIGIN, so both read it through resolveMcpOrigin rather than writing the hosted one in.

export const DEFAULT_MCP_ORIGIN = 'https://mcp.livediagram.app';

// The build-time value, or the hosted default when it is unset OR blank.
// Blank matters: the production deploy passes `mcp_origin: ''` into
// NEXT_PUBLIC_MCP_ORIGIN, and GitHub Actions sets an empty input as an empty
// string, not an absent variable. With `??` that empty string survived, the
// origin became '', and the consent page fetched `/oauth/session/...` and
// `/oauth/complete` from livediagram.app itself: a 404 that read as "This link
// has expired" for every connecting client.
export function resolveMcpOrigin(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : DEFAULT_MCP_ORIGIN;
}

/** The address an AI tool connects to: the MCP worker's streamable HTTP endpoint. */
export const mcpEndpoint = (origin: string): string => `${origin}/mcp`;
