// How liveknowledge's MCP server is listed (docs/specs/015-api/mcp-server.md §4.16): the one identity its
// `initialize` serverInfo and its server card are made from.
import { mcpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING = mcpListing({
  product: 'liveknowledge',
  description:
    "Search, read and suggest edits to a team's knowledgebase, with how far each page can be trusted.",
  version: '0.1.0',
});
