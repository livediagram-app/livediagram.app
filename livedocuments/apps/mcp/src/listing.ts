// How livedocuments's MCP server is listed (docs/specs/015-api/mcp-server.md §4.16): the one identity its
// `initialize` serverInfo and its server card are made from.
import { mcpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING = mcpListing({
  product: 'livedocuments',
  description:
    'Create, edit, share and render articles, slide decks and infographics on livedocuments.app.',
  version: '0.1.0',
});
