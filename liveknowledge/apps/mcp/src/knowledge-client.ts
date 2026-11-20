// The api as a knowledgebase tool reaches it (docs/specs/024-agents/knowledgebase-for-agents.md): the caller's
// token, the MCP door, and the client's name, so each read is counted under the agent that made it
// (agent-name.ts). And the link and the page reference every one of those tools builds.
import type { ApiClient } from '@liveworkspace/api-client';
import { CLIENT_HEADER } from '@liveknowledge/api-schema';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { AGENT_NAME_HEADER, clientNameFor } from './agent-name';
import { clientFor } from './api';
import { requireToken, type Extra } from './tool-helpers';

export async function knowledgeApi(server: McpServer, env: Env, extra: Extra): Promise<ApiClient> {
  const token = requireToken(extra);
  const name = await clientNameFor(server, env, token);
  return clientFor(env, token, {
    [CLIENT_HEADER]: 'mcp',
    ...(name ? { [AGENT_NAME_HEADER]: name } : {}),
  });
}

/** `/documents/<id>` and what follows, each part encoded: a page may be named by its title. */
export const knowledgePath = (documentId: string, ...parts: string[]) =>
  `/documents/${[documentId, ...parts].map(encodeURIComponent).join('/')}`;

export const jsonBody = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
