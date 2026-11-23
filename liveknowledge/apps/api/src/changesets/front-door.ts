import type { AgentHeaders } from '@liveworkspace/index-app';
import { CLIENT_HEADER, CLIENT_KINDS, type ClientKind } from '@liveknowledge/api-schema';

// Which surface sent a changeset or a revert, for the Agent telemetry type
// (docs/specs/024-agents/agent-changesets.md "Observability and telemetry", CS25): the MCP server,
// the CLI and the editor say so in X-Liveknowledge-Client; anything else is a plain API caller.
export type FrontDoor = 'Mcp' | 'Cli' | 'Editor' | 'Api';

const DOORS: Record<ClientKind, FrontDoor> = { mcp: 'Mcp', cli: 'Cli', editor: 'Editor' };

function isClientKind(value: string | undefined): value is ClientKind {
  return value !== undefined && (CLIENT_KINDS as readonly string[]).includes(value);
}

export function frontDoorOf(request: Request): FrontDoor {
  const value = request.headers.get(CLIENT_HEADER)?.trim().toLowerCase();
  return isClientKind(value) ? DOORS[value] : 'Api';
}

/** The header an agent's front door names its client in (the MCP client's name, "Claude Code"). Optional. */
export const AGENT_NAME_HEADER = 'X-Liveknowledge-Agent';

/** The headers an agent's request names its door and its client in, for the History it leaves
 *  (@liveworkspace/index-app itemAgentOf, Work Tracker 1381). */
export const AGENT_HEADERS: AgentHeaders = { client: CLIENT_HEADER, agent: AGENT_NAME_HEADER };
