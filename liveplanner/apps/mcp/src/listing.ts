// How liveplanner's MCP server is listed (docs/specs/015-api/mcp-server.md §4.16): the one identity its
// `initialize` serverInfo and its server card are made from.
import { mcpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING = mcpListing({
  product: 'liveplanner',
  description:
    'Plan on liveplanner.app: boards of cards, spreadsheets, dashboards and forms, shared live.',
  version: '0.1.0',
});
