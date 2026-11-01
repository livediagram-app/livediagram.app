// Build the MCP server for one request (stateless): the schema resource + the
// four tools, closing over the worker env for api calls. The caller's Bearer
// token arrives per-request via the transport's authInfo and is read inside
// each tool, so a fresh server per request carries no cross-request state.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { serverIdentity } from '@liveworkspace/mcp-kit/listing';
import {
  elementSchemaDoc,
  SCHEMA_RESOURCE_URI,
  SERVER_INSTRUCTIONS,
} from '@livediagram/agent-verbs/mcp';
import { LISTING } from './listing';
import { registerTools } from './tools';
import { registerPrompts } from './prompts';

export function buildServer(env: Env): McpServer {
  const server = new McpServer(serverIdentity(LISTING), { instructions: SERVER_INSTRUCTIONS });

  server.registerResource(
    'element-schema',
    SCHEMA_RESOURCE_URI,
    {
      title: 'livediagram element schema',
      description:
        'Element types, shape vocabulary, pinned-arrow anchors, and design rules for ' +
        'producing well-formed diagrams. Read before create_document / update_document.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: elementSchemaDoc() }],
    }),
  );

  registerTools(server, env);
  registerPrompts(server);
  return server;
}
