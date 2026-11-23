import type { AgentHeaders } from '@liveworkspace/index-app';
import {
  AGENT_NAME_HEADER,
  CLIENT_HEADER,
  CLIENT_KINDS,
  type ClientKind,
} from '@livedocuments/api-schema';

// Which surface sent a changeset or a revert, for the Agent telemetry type
// (docs/specs/024-agents/agent-changesets.md "Observability and telemetry", CS25): the MCP server,
// the CLI and the editor say so in X-Livedocuments-Client; anything else is a plain API caller.
export type FrontDoor = 'Mcp' | 'Cli' | 'Editor' | 'Api';

const DOORS: Record<ClientKind, FrontDoor> = { mcp: 'Mcp', cli: 'Cli', editor: 'Editor' };

function isClientKind(value: string | undefined): value is ClientKind {
  return value !== undefined && (CLIENT_KINDS as readonly string[]).includes(value);
}

export function frontDoorOf(request: Request): FrontDoor {
  const value = request.headers.get(CLIENT_HEADER)?.trim().toLowerCase();
  return isClientKind(value) ? DOORS[value] : 'Api';
}

/** The headers an agent's request names its door and its client in (the MCP sends both, mcp-server.md §2), for the
 *  History it leaves (@liveworkspace/index-app itemAgentOf, Work Tracker 1381). */
export const AGENT_HEADERS: AgentHeaders = { client: CLIENT_HEADER, agent: AGENT_NAME_HEADER };
