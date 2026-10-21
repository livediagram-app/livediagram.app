import { CLIENT_HEADER, CLIENT_KINDS, type ClientKind } from '@livediagram/api-schema';

// Which surface sent a changeset or a revert, for the Agent telemetry type
// (docs/specs/024-agents/agent-changesets.md "Observability and telemetry", CS25): the MCP server,
// the CLI and the editor say so in X-Livediagram-Client; anything else is a plain API caller.
export type FrontDoor = 'Mcp' | 'Cli' | 'Editor' | 'Api';

const DOORS: Record<ClientKind, FrontDoor> = { mcp: 'Mcp', cli: 'Cli', editor: 'Editor' };

function isClientKind(value: string | undefined): value is ClientKind {
  return value !== undefined && (CLIENT_KINDS as readonly string[]).includes(value);
}

export function frontDoorOf(request: Request): FrontDoor {
  const value = request.headers.get(CLIENT_HEADER)?.trim().toLowerCase();
  return isClientKind(value) ? DOORS[value] : 'Api';
}
