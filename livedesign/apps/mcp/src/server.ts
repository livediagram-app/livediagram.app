// Build the MCP server for one request (stateless): the schema resource + the
// four tools, closing over the worker env for api calls. The caller's Bearer
// token arrives per-request via the transport's authInfo and is read inside
// each tool, so a fresh server per request carries no cross-request state.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  elementSchemaDoc,
  SCHEMA_RESOURCE_URI,
  SERVER_INSTRUCTIONS,
} from '@livedesign/agent-verbs/mcp';
import { registerTools } from './tools';
import { registerShowMyPrompt } from '@liveworkspace/mcp-kit/prompts';

export function buildServer(env: Env): McpServer {
  const server = new McpServer(
    { name: 'livedesign', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerResource(
    'element-schema',
    SCHEMA_RESOURCE_URI,
    {
      title: 'livedesign element schema',
      description:
        'Element types, shape vocabulary, pinned-arrow anchors, and design rules for ' +
        'producing well-formed pages. Read before create_design / update_design.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: elementSchemaDoc() }],
    }),
  );

  registerTools(server, env);
  // The one prompt (docs/specs/015-api/mcp-server.md §4.10): show_my_design.
  registerShowMyPrompt(server, {
    product: 'livedesign',
    record: 'design',
    shown: { one: 'design', many: 'designs' },
    called: 'design',
  });
  return server;
}
