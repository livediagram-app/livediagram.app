// account — owner-wide deletion. It touches everything this app keeps for a person beside their designs, so it lives
// here rather than under any one resource. The person's designs are the index's (liveworkspace/docs/specs/004-index/one-explorer.md):
// the index purges them when the account closes, and has each design's Durable Object drop its content.

import { communityService } from '../community-service';
import { mediaClient, mediaOwner } from '../media';
import type { Env } from '../types';

// Wipe what this app keeps for a person beside their designs: their images in liveworkspace's media service, from
// every app (src/media.ts), and the Community copies they took, which stop counting. Their workbench (pairings, tickets and sessions) is liveworkspace's, which drops it when
// the account closes (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"). Called from DELETE /api/account and when the index tells this app an account closed (routes/internal-items.ts
// `personClosed`), wherever it was closed. Their name and colour, settings, address, sign-up and API tokens are the
// liveworkspace accounts Worker's, which deletes them when it closes the account (liveworkspace/docs/specs/003-accounts/accounts.md
// "Closing an account"). Idempotent: re-running with the same owner id is a no-op once they are gone. Answers the
// number of images deleted.
export async function deleteAccount(env: Env, ownerId: string): Promise<{ images: number }> {
  // The images first, so a failure leaves the account whole to delete again.
  const media = mediaClient(env);
  let images = 0;
  if (media) {
    const forgotten = await media.forgetOwner(await mediaOwner(ownerId));
    if (!forgotten.ok)
      throw new Error(`media: deleting the owner's images answered ${forgotten.status}`);
    images = forgotten.value.deleted;
  }
  await communityService.forgetCopier(env, ownerId);
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's designs are in
  // those designs' own stores (each design's Durable Object), out of reach of one statement; they age out with the
  // 30-day changeset retention there. Their photo blobs go with each design's purge (db/photo-blobs.ts).
  return { images };
}
