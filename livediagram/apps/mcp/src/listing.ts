// How livediagram's MCP server is listed (docs/specs/015-api/mcp-server.md §4.16): the one identity its
// `initialize` serverInfo and its server card are made from.
import { mcpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING = mcpListing({
  product: 'livediagram',
  description:
    'Create, edit, share and render real-time collaborative diagrams and mind maps on livediagram.app.',
  version: '0.2.0',
});
