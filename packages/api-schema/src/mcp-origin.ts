// Origin of a product's MCP worker (docs/specs/015-api/mcp-server.md), shared by every app that names it: the live
// editor's OAuth consent pages and the marketing site's Build with AI page. Other deployments override it at build
// time with NEXT_PUBLIC_MCP_ORIGIN, so both read it through the product's resolveMcpOrigin rather than writing the
// hosted one in. Each product's api-schema names its hosted origin and binds the resolver to it.

// The build-time value, or the hosted default when it is unset OR blank.
// Blank matters: the production deploy passes `mcp_origin: ''` into
// NEXT_PUBLIC_MCP_ORIGIN, and GitHub Actions sets an empty input as an empty
// string, not an absent variable. With `??` that empty string survived, the
// origin became '', and the consent page fetched `/oauth/session/...` and
// `/oauth/complete` from the product's own site: a 404 that read as "This link
// has expired" for every connecting client.
export function createMcpOriginResolver(
  defaultOrigin: string,
): (raw: string | undefined) => string {
  return (raw) => {
    const trimmed = raw?.trim();
    if (!trimmed) return defaultOrigin;
    // Trailing slashes off by a scan, not a regex: `/\/+$/` backtracks on a long run of slashes.
    let end = trimmed.length;
    while (end > 0 && trimmed[end - 1] === '/') end--;
    // Nothing but slashes is no origin: the hosted one, as for a blank value.
    return trimmed.slice(0, end) || defaultOrigin;
  };
}

/** The address an AI tool connects to: the MCP worker's streamable HTTP endpoint. */
export const mcpEndpoint = (origin: string): string => `${origin}/mcp`;
