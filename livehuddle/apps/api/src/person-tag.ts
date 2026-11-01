import { sha256Hex } from '@livediagram/api-schema';

// The room's stand-in for an owner (docs/specs/024-agents/agent-presence.md, PR2): an opaque,
// per-document SHA-256 of the document id and the owner id. The room holds no owner id (docs/specs/
// 015-api/public-api-and-tokens.md §6), yet must tell an agent's owner's own sessions from everyone
// else's: their selection is what the agent's `selected` reads, and it never holds against their
// own agent. Unusable on any other document, and never sent to a client.
export async function personTagFor(documentId: string, ownerId: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`${documentId}:${ownerId}`));
}
