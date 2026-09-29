// Origin of the MCP worker (docs/specs/015-api/mcp-server.md). The OAuth consent page posts the minted
// token to this TRUSTED origin (never one from the request query, so a forged
// authorize can't exfiltrate the token). Self-hosters override at build time.

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

export const MCP_ORIGIN = resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN);
