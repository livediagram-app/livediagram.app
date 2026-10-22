import { sha256Hex } from '@liveplanner/api-schema';

// The room's stand-in for an owner (docs/specs/024-agents/agent-presence.md, PR2): an opaque,
// per-project SHA-256 of the project id and the owner id. The room holds no owner id (docs/specs/
// 015-api/public-api-and-tokens.md §6), yet must tell an agent's owner's own sessions from everyone
// else's: their selection is what the agent's `selected` reads, and it never holds against their
// own agent. Unusable on any other project, and never sent to a client.
export async function personTagFor(projectId: string, ownerId: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`${projectId}:${ownerId}`));
}
