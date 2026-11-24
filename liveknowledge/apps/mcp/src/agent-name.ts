// The name an agent's reads are counted under (docs/specs/030-knowledgebase/insights.md "Reads";
// docs/specs/024-agents/knowledgebase-for-agents.md): the MCP client's own, from its `initialize` handshake's
// clientInfo ("Claude Code", "Cursor"), sent to the api as `X-Liveknowledge-Agent` with every call. Every product's
// MCP shares the rule and the memory (@liveworkspace/mcp-kit/agent-name, Work Tracker 1381): the kit's app remembers
// the handshake's name and names each api call by it.
import { AGENT_NAME_HEADER, CLIENT_HEADER } from '@liveknowledge/api-schema';

export {
  AGENT_NAME_MAX_CHARS,
  AGENT_NAME_TTL_SECONDS,
  HANDSHAKE_MAX_BYTES,
  agentNameOf,
  clientNameFor,
  rememberClientName,
} from '@liveworkspace/mcp-kit/agent-name';

export { AGENT_NAME_HEADER };

/** The headers every api call names its door and its client in (api.ts). */
export const MCP_AGENT_HEADERS = { client: CLIENT_HEADER, agent: AGENT_NAME_HEADER } as const;
