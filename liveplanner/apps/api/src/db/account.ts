// account — owner-wide deletion. It touches everything this app keeps for a person beside their plans, so it lives
// here rather than under any one resource. The person's plans are the index's (liveworkspace/docs/specs/004-index/one-explorer.md):
// the index purges them when the account closes, and has each plan's Durable Object drop its content.

import { mediaClient, mediaOwner } from '../media';
import type { Env } from '../types';

// Wipe what this app keeps for a person beside their plans: every owner-keyed table in docs/specs/015-api/api.md
// "Owner-keyed data" (account-owner-columns.test.ts holds this to that list against the real schema). Their
// workbench (pairings, tickets and sessions) is liveworkspace's, which drops it when the account closes
// (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"). Called from DELETE /api/account and when
// the index tells this app an account closed (routes/internal-items.ts `personClosed`), wherever it was closed.
// Their name and colour, settings, address, sign-up and API tokens are the liveworkspace accounts Worker's, which
// deletes them when it closes the account (liveworkspace/docs/specs/003-accounts/accounts.md "Closing an account"). Idempotent:
// re-running with the same owner id is a no-op once the rows are gone.
// The pictures they uploaded for Image fields go from liveworkspace's media service first (src/media.ts), which
// deletes every image the account uploaded, so a failure leaves the account whole to delete again.
export async function deleteAccount(env: Env, ownerId: string): Promise<void> {
  const media = mediaClient(env);
  if (media) {
    const forgotten = await media.forgetOwner(await mediaOwner(ownerId));
    if (!forgotten.ok)
      throw new Error(`media: deleting the owner's images answered ${forgotten.status}`);
  }
  // What they had seen of forms is the index's (collab_form_reads), which drops it with the account.
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's plans are in
  // those plans' own stores (each plan's Durable Object), out of reach of one statement; they age out with the
  // 30-day changeset retention there.
}
