// Origin of the MCP worker (docs/specs/015-api/mcp-server.md). The OAuth consent page posts the minted
// token to this TRUSTED origin (never one from the request query, so a forged
// authorize can't exfiltrate the token). Self-hosters override at build time; the resolver is shared with the
// marketing site's Build with AI page (@livedocuments/api-schema, mcp-origin.ts).

import { resolveMcpOrigin } from '@livedocuments/api-schema';

export const MCP_ORIGIN = resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN);
