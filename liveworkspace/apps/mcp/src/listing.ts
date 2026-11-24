// How the one MCP names itself (its serverInfo and server card). Unlisted while it is tried
// (liveworkspace/docs/specs/021-mcp/mcp.md): no registry descriptor, no directory entry.
import type { McpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING: McpListing = {
  product: 'liveworkspace',
  registryName: 'io.github.livediagram-app/liveworkspace',
  title: 'liveworkspace',
  description:
    'Diagrams, docs, plans, designs and knowledgebases in your liveworkspace apps, through one connection.',
  version: '0.1.0',
  websiteUrl: 'https://www.liveworkspace.app',
  iconUrl: 'https://www.liveworkspace.app/liveworkspace-icon-512.png',
  documentationUrl: 'https://www.liveworkspace.app',
  remoteUrl: 'https://mcp.liveworkspace.app/mcp',
};
