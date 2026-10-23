// account — owner-wide deletion. It touches everything this app keeps for a person beside their documents, so it
// lives here rather than under any one resource. The person's documents are the index's
// (liveworkspace/docs/one-explorer.md): the index purges them when the account closes, and has each document's
// Durable Object drop its content.

import { mediaClient, mediaOwner } from '../media';
import type { Env } from '../types';
import { workbenchStore } from '../workbench-store';

// Wipe what this app keeps for a person beside their documents (docs/specs/015-api/api.md "Owner-keyed data"):
// their images in liveworkspace's media service (src/media.ts), which deletes every image the account uploaded, in
// any app, and their workbench store (pairings, tickets and sessions, whose rooms it closes). Called from DELETE
// /api/account and when the index tells this app an account closed (routes/internal-items.ts `personClosed`),
// wherever it was closed. Their name and colour, settings, address, sign-up and API tokens are the liveworkspace
// accounts Worker's, which deletes them when it closes the account (liveworkspace/docs/accounts.md "Closing an
// account"). Returns how many images went. Idempotent: re-running with the same owner id is a no-op once they are
// gone.
export async function deleteAccount(env: Env, ownerId: string): Promise<{ images: number }> {
  // Their images first, so a failure leaves the account whole to delete again.
  const media = mediaClient(env);
  let images = 0;
  if (media) {
    const forgotten = await media.forgetOwner(await mediaOwner(ownerId));
    if (!forgotten.ok)
      throw new Error(`media: deleting the owner's images answered ${forgotten.status}`);
    images = forgotten.value.deleted;
  }
  await workbenchStore(env, ownerId).close();
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's documents are
  // in those documents' own stores (each document's Durable Object), out of reach of one statement; they age out
  // with the 30-day changeset retention there.
  return { images };
}
