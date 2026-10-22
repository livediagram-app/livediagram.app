// Build the MCP server for one request (stateless): the schema resource + the
// tools, closing over the worker env for api calls. The caller's Bearer
// token arrives per-request via the transport's authInfo and is read inside
// each tool, so a fresh server per request carries no cross-request state.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';
import {
  elementSchemaDoc,
  SCHEMA_RESOURCE_URI,
  SERVER_INSTRUCTIONS,
} from '@liveplanner/agent-verbs/mcp';
import { registerTools } from './tools';
import { registerPrompts } from './prompts';

export function buildServer(env: Env): McpServer {
  const server = new McpServer(
    { name: 'liveplanner', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerResource(
    'element-schema',
    SCHEMA_RESOURCE_URI,
    {
      title: 'liveplanner element schema',
      description:
        "The elements a tab holds (a board, a sheet, a Dashboard's views and charts) and the fields " +
        'each takes. Read before create_project / update_project with raw elements.',
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
