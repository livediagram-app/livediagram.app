// Origin of the MCP worker (spec/62). The OAuth consent page posts the minted
// token to this TRUSTED origin (never one from the request query, so a forged
// authorize can't exfiltrate the token). Self-hosters override at build time.
export const MCP_ORIGIN = process.env.NEXT_PUBLIC_MCP_ORIGIN ?? 'https://mcp.livediagram.app';
