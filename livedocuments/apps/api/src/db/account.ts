// account — owner-wide deletion. It touches every table keyed on an owner, so it lives here rather than under
// any one resource. The person's documents are the index's (liveworkspace/docs/one-explorer.md): routes/account.ts
// has the index purge them, and the index has each document's Durable Object drop its content.

import { mediaClient, mediaOwner } from '../media';
import type { Env } from '../types';

// Wipe what this app keeps for an owner: every owner-keyed table in docs/specs/015-api/api.md "Owner-keyed
// data", and their images in liveworkspace's media service (src/media.ts), which deletes every image the
// account uploaded, in any app. account-owner-columns.test.ts holds this to that list against the real schema.
// Called from DELETE /api/account. Their name and colour, settings, address and sign-up are kept by the
// liveworkspace accounts Worker, which deletes them when it closes the account (liveworkspace/docs/accounts.md
// "Closing an account"). Returns how many images went. Idempotent: re-running with the same owner id is a
// no-op once the rows are gone.
export async function deleteAccount(env: Env, ownerId: string): Promise<{ images: number }> {
  // Their images first, so a failure leaves the account whole to delete again.
  const media = mediaClient(env);
  let images = 0;
  if (media) {
    const forgotten = await media.forgetOwner(await mediaOwner(ownerId));
    if (!forgotten.ok) throw new Error(`media: deleting the owner's images answered ${forgotten.status}`);
    images = forgotten.value.deleted;
  }
  const by = (sql: string) => env.DB.prepare(sql).bind(ownerId);
  await env.DB.batch([
    // Workbench rows (docs/specs/013-workspace/workbench-embeds.md), before the tokens they were minted from.
    by('DELETE FROM workbench_sessions WHERE owner_id = ?'),
    by('DELETE FROM workbench_tickets WHERE owner_id = ?'),
    by('DELETE FROM workbench_pairings WHERE owner_id = ?'),
    by('DELETE FROM workbench_pairing_requests WHERE owner_id = ?'),
    // api_tokens (docs/specs/015-api/public-api-and-tokens.md): no API credential outlives the account.
    by('DELETE FROM api_tokens WHERE owner_id = ?'),
  ]);
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's documents are
  // in those documents' own stores (each document's Durable Object), out of reach of one statement; they age out
  // with the 30-day changeset retention there.
  return { images };
}
