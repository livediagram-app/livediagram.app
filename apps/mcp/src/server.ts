// Build the MCP server for one request (stateless): the schema resource + the
// four tools, closing over the worker env for api calls. The caller's Bearer
// token arrives per-request via the transport's authInfo and is read inside
// each tool, so a fresh server per request carries no cross-request state.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';
import { elementSchemaDoc, SCHEMA_RESOURCE_URI, SERVER_INSTRUCTIONS } from './schema';
import { registerTools } from './tools';

export function buildServer(env: Env): McpServer {
  const server = new McpServer(
    { name: 'livediagram', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerResource(
    'element-schema',
    SCHEMA_RESOURCE_URI,
    {
      title: 'livediagram element schema',
      description:
        'Element types, shape vocabulary, pinned-arrow anchors, and design rules for ' +
        'producing well-formed diagrams. Read before create_diagram / update_diagram.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: elementSchemaDoc() }],
    }),
  );

  registerTools(server, env);
  return server;
}
