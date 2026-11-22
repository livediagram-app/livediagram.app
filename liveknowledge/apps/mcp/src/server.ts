// Build the MCP server for one request (stateless): its instructions, its tools and its one prompt, closing over
// the worker env for api calls. The caller's Bearer token arrives per-request via the transport's authInfo and is
// read inside each tool, so a fresh server per request carries no cross-request state.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { serverIdentity } from '@liveworkspace/mcp-kit/listing';
import { SERVER_INSTRUCTIONS } from '@liveknowledge/agent-verbs/mcp';
import { LISTING } from './listing';
import { registerTools } from './tools';
import { registerShowMyPrompt } from '@liveworkspace/mcp-kit/prompts';

export function buildServer(env: Env): McpServer {
  // The instructions send an agent to get_context first and say how to treat what it reads
  // (docs/specs/024-agents/knowledgebase-for-agents.md).
  const server = new McpServer(serverIdentity(LISTING), { instructions: SERVER_INSTRUCTIONS });
  registerTools(server, env);
  // The one prompt (docs/specs/015-api/mcp-server.md §4.10): show_my_document.
  registerShowMyPrompt(server, {
    product: 'liveknowledge',
    record: 'document',
    shown: { one: 'knowledgebase', many: 'knowledgebases' },
    called: 'knowledgebase',
  });
  return server;
}
