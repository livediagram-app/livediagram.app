// account — what this app keeps for a person beside their canvases, closed or merged as one. The person's canvases
// are the index's (liveworkspace/docs/one-explorer.md): the index purges them when the account closes, and has each
// canvas's Durable Object drop its content; it moves a guest's to the account when accounts merge them.

import { forgetCommunityCopier, mergeCommunityCopier } from '../community-service';
import { disconnectDrive } from '../drive/disconnect';
import { mediaClient, mediaOwner } from '../media';
import { personStore } from '../person-client';
import type { Env } from '../types';

// Wipe what this app keeps for a person beside their canvases (docs/specs/015-api/api.md "Owner-keyed data"): their
// images in liveworkspace's media service (src/media.ts), which deletes every image the account uploaded, in any app;
// their Google Drive mirror (the grant revoked at Google; the Drive files are theirs and stay); their own store
// (person-store.ts: shape libraries and what is left of the mirror); and the Community copies they took, which stop
// counting. Their workbench (pairings, tickets and sessions) is liveworkspace's, which drops it when the account
// closes (liveworkspace/docs/workbench.md "Ending access"). Called from DELETE
// /api/account and when the index tells this app an account closed (routes/internal-items.ts `personClosed`),
// wherever it was closed. Their name and colour, settings, address, sign-up, teams and API tokens are the
// liveworkspace accounts Worker's, which deletes them when it closes the account (liveworkspace/docs/accounts.md
// "Closing an account"). Returns how many images went. Idempotent: re-running with the same owner id is a no-op once
// they are gone.
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
  // The Drive grant is revoked at Google first, while the store still holds its sealed token.
  await disconnectDrive(env, ownerId);
  await personStore(env, ownerId).purge();
  await forgetCommunityCopier(env, ownerId);
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's canvases are
  // in those canvases' own stores (each canvas's Durable Object), out of reach of one statement; they age out with
  // the 30-day changeset retention there.
  return { images };
}

// A guest who became an account (accounts merged them, with their settings and profile; the index moved their
// canvases, folders, stars and Timeline): what this app keeps for the guest becomes the account's. Their images in
// the media service, their shape libraries, and their Community copies. Idempotent, so a retry moves nothing twice.
// A guest has no workbench (it needs a token) and no Drive mirror (it needs an account).
export async function mergeGuest(env: Env, guestId: string, userId: string): Promise<void> {
  // The images first, so a failure leaves the guest whole to merge again.
  const media = mediaClient(env);
  if (media) {
    const merged = await media.mergeOwner(await mediaOwner(guestId), await mediaOwner(userId));
    if (!merged.ok) throw new Error(`media: merging the guest's images answered ${merged.status}`);
  }
  await migrateShapeLibraries(env, guestId, userId);
  await mergeCommunityCopier(env, guestId, userId);
}

// Shape libraries (docs/specs/013-workspace/shape-libraries.md): the guest's move from the guest's store into the
// account's; one whose name the account already uses takes the next free " (n)" first, so the account never holds
// two libraries of one name. The cap applies to creates, never to this move. The guest's store is emptied once the
// account's holds them.
export async function migrateShapeLibraries(env: Env, fromOwnerId: string, toOwnerId: string) {
  const guest = personStore(env, fromOwnerId);
  const records = await guest.exportShapeLibraries();
  if (records.length === 0) return;
  const { moved, renamed } = await personStore(env, toOwnerId).adoptShapeLibraries(records);
  await guest.purge();
  console.info('[shape-libraries] migrated', { moved, renamed });
}
