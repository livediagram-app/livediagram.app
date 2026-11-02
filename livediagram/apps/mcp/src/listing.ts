// How livediagram's MCP server is listed (docs/specs/015-api/mcp-server.md §4.16): the one identity its
// `initialize` serverInfo, its server card and livediagram/server.json are made from. A version bump here goes into
// server.json too (server-json.test.ts keeps them equal), and the registry needs one to republish.
import { mcpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING = mcpListing({
  product: 'livediagram',
  description:
    'Create, edit, share and render real-time collaborative diagrams and mind maps on livediagram.app.',
  version: '0.2.0',
});
