// How the one MCP names itself (liveworkspace/docs/specs/021-mcp/mcp.md): its serverInfo, its server card and
// liveworkspace/server.json, the MCP Registry descriptor (server-json.test.ts keeps them equal). A version bump here
// goes into server.json too, and the registry needs one to republish.
import type { McpListing } from '@liveworkspace/mcp-kit/listing';

export const LISTING: McpListing = {
  product: 'liveworkspace',
  registryName: 'io.github.livediagram-app/liveworkspace',
  title: 'liveworkspace',
  description:
    'Your liveworkspace diagrams, docs, plans, designs and knowledgebases, through one connection.',
  version: '0.1.0',
  websiteUrl: 'https://www.liveworkspace.app',
  iconUrl: 'https://www.liveworkspace.app/liveworkspace-icon-512.png',
  documentationUrl: 'https://www.liveworkspace.app',
  remoteUrl: 'https://mcp.liveworkspace.app/mcp',
};
