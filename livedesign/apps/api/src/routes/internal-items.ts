// /api/internal/items/**: the One Explorer index's doors into a design's content (docs/specs/015-api/api.md
// "Internal"), served by @liveworkspace/index-app's handleInternalItems with the app's key (INDEX_KEY). See it for
// the doors: a purge (one design, or up to a hundred for a closed account), revoked links, notices for the emails,
// a copy into a new design, and a workbench pairing's sessions closed in a design's room
// (liveworkspace/docs/workbench.md "Ending access").
//
// Each is a call to the design's Durable Object (design-client.ts). Where the design is filed, its sharing and its
// Trash are the index's; a purge also drops the design's previews in liveworkspace's media service
// (liveworkspace/docs/previews.md "Purging"). A notice is worked out off the index's path: a share link made (the
// first-share milestone), or someone's first time in through a link (the owner's "someone joined" email). The export
// door draws the design for liveworkspace's previews, which call it with MEDIA_KEY.
import { JOINED_TELEMETRY_TYPE, handleInternalItems as handle } from '@liveworkspace/index-app';
import { notifyFirstShare } from '../email/notifications';
import { deleteAccount } from '../db/account';
import { mergeMediaOwner } from '../media';
import { purgeDesignPreviews } from '../db/designs';
import { designRoom } from '../design-client';
import { closeWorkbenchSessions } from '../room-access-client';
import { reportServerEvent } from '../server-telemetry';
import type { Env } from '../types';

export function handleInternalItems(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  return handle(request, {
    key: env.INDEX_KEY,
    exportKey: env.MEDIA_KEY,
    waitUntil,
    handlers: {
      purge: async (id) => {
        await designRoom(env, id).purge();
        await purgeDesignPreviews(env, id);
      },
      // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends
      // them away.
      revoke: (id, codes, reason) => designRoom(env, id).revokeCodes(codes, reason),
      notice: (id, notice) =>
        notice.type === 'shared'
          ? notifyFirstShare(env, notice.actorId)
          : // Someone's first time in through a link: the owner's email, and Document·Joined by the link's level.
            Promise.all([
              designRoom(env, id).joined(notice.personId),
              reportServerEvent(env, 'Document', 'Joined', JOINED_TELEMETRY_TYPE[notice.level]),
            ]),
      // A closed account, wherever it was closed: what livedesign keeps for them beside their designs (their images),
      // and their name off each design of someone else's that names them.
      personClosed: (personId) => deleteAccount(env, personId),
      // A guest who became an account (accounts merged them; the index tells each app): their images in
      // liveworkspace's media service become the account's. A guest has no workbench (it needs a token), and their
      // designs are the index's to move.
      personMerged: (guestId, userId) => mergeMediaOwner(env, guestId, userId),
      anonymise: (id, personId) => designRoom(env, id).anonymise(personId),
      // A workbench pairing's access ended at liveworkspace: its sockets in this design's room close.
      workbenchClose: (id, pairingId) => closeWorkbenchSessions(env, id, pairingId),
      copy: async (from, to, tabId, copier) => {
        // The source as the copier may take it: anyone but the owner takes the comments as the tab read serves them.
        const copy = await designRoom(env, from).exportCopy(tabId, copier.by);
        // No such design, or no such tab in it.
        if (!copy || (tabId && copy.tabs.length === 0)) return 'not_found';
        // The target is a new design: a copy into one that already holds this content fails its keys, and nothing
        // is written (importCopy is one transaction); the kit answers that as a conflict.
        await designRoom(env, to).importCopy(copy);
        return { tabs: copy.tabs.length, items: 0 };
      },
      // The design drawn, for liveworkspace's previews (design-room.ts `exportImage`).
      export: (id, query) => designRoom(env, id).exportImage(query),
    },
  });
}
