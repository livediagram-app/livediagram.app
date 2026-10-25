// /api/internal/items/**: the liveworkspace index's doors into a canvas's content (docs/specs/015-api/api.md
// "Internal"), answered by the shared kit (@liveworkspace/index-app handleInternalItems): the bearer check against
// INDEX_KEY, the paths and their bodies. See it for the doors: a purge (one canvas, or up to a hundred for a closed
// account), revoked links, notices for the emails, a copy into a new canvas, a person closed, merged or
// anonymised, and a workbench pairing's sessions closed in a canvas's room (liveworkspace/docs/workbench.md
// "Ending access").
//
// Each is a call to the canvas's Durable Object (document-client.ts) or the person's own stores. Where the canvas is
// filed, its sharing and its Trash are the index's; a purge also tells the media service the canvas places nothing
// now and drops its previews there (liveworkspace/docs/previews.md "Purging"). A notice is worked out off the index's
// path: a share link made (the first-share milestone), or someone's first time in through a link (the owner's
// "someone joined" email). The export door draws the canvas for liveworkspace's previews, which call it with
// MEDIA_KEY, and answers its whole file for liveworkspace's Drive mirror, which calls it and the import door with
// DRIVE_KEY (liveworkspace/docs/drive.md "Contracts > The apps", routes/internal-file.ts).
import { JOINED_TELEMETRY_TYPE, handleInternalItems as handle } from '@liveworkspace/index-app';
import { countCommunityCopy } from '../community-service';
import { deleteAccount, mergeGuest } from '../db/account';
import { purgeDocumentPreviews } from '../db/documents';
import { documentRoom } from '../document-client';
import { forgetImageRefs } from '../document-room/document-outbox';
import { notifyFirstShare } from '../email/notifications';
import { closeWorkbenchSessions } from '../room-access-client';
import { reportServerEvent } from '../server-telemetry';
import { importDocumentFileFor } from './internal-file';
import type { Env } from '../types';

export function handleInternalItems(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  return handle(request, {
    key: env.INDEX_KEY,
    exportKey: env.MEDIA_KEY,
    driveKey: env.DRIVE_KEY,
    waitUntil,
    handlers: {
      purge: async (id) => {
        await documentRoom(env, id).purge();
        // The media service hears the canvas places nothing now, so an image only it placed can be swept.
        await Promise.all([purgeDocumentPreviews(env, id), forgetImageRefs(env, id)]);
      },
      // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends
      // them away.
      revoke: (id, codes, reason) => documentRoom(env, id).revokeCodes(codes, reason),
      notice: (id, notice) =>
        notice.type === 'shared'
          ? notifyFirstShare(env, notice.actorId)
          : // Someone's first time in through a link: the owner's email, and Document·Joined by the link's level.
            Promise.all([
              documentRoom(env, id).joined(notice.personId),
              reportServerEvent(env, 'Document', 'Joined', JOINED_TELEMETRY_TYPE[notice.level]),
            ]),
      copy: async (from, to, tabId, copier) => {
        // The source as the copier may take it: anyone but the owner takes the comments as the tab read serves
        // them; through the canvas's Community post's link, without its comments or the people on its actions.
        const source = await documentRoom(env, from).exportCopy(tabId, copier);
        // No such canvas, or no such tab in it.
        if (!source || (tabId && source.copy.tabs.length === 0)) return 'not_found';
        // The target is a new canvas: importCopy is one transaction, so a copy into one that already holds this
        // content fails its keys and writes nothing (the kit answers 409). The copy carries a grant for each image
        // its source could serve, so it serves them too (docs/specs/009-elements/images.md "Placement grants").
        await documentRoom(env, to).importCopy(source.copy);
        // A copy through a Community post's link counts toward the post (docs/specs/025-community/community.md
        // "Likes"), once per copier and at most a few from one network: the copier's address as the index saw it
        // (an Explorer's copy). The api's own copy door counted it first (routes/document-index-routes.ts), so this
        // adds nothing then. An index that names no address counts the copier as their own network.
        if (source.community && copier.by)
          waitUntil(countCommunityCopy(env, from, copier.by, copier.ip ?? `copier:${copier.by}`));
        return { tabs: source.copy.tabs.length, items: 0 };
      },
      // A closed account, wherever it was closed: what livediagram keeps for them beside their canvases.
      personClosed: async (personId) => void (await deleteAccount(env, personId)),
      // A guest who became an account: what livediagram keeps for the guest becomes the account's.
      personMerged: (guestId, userId) => mergeGuest(env, guestId, userId),
      // Their name off each canvas of someone else's that names them.
      anonymise: (id, personId) => documentRoom(env, id).anonymise(personId),
      // The canvas drawn, for liveworkspace's previews (document-room.ts `exportImage`), or its whole file, for the
      // Drive mirror (`exportFile`).
      export: (id, query) =>
        query.format === 'file'
          ? documentRoom(env, id).exportFile(query)
          : documentRoom(env, id).exportImage(query),
      // A new canvas from a Drive file, as its owner's (routes/internal-file.ts).
      import: (input) => importDocumentFileFor(env, input),
      // A workbench pairing's access ended at liveworkspace: its sockets in this canvas's room close.
      workbenchClose: (id, pairingId) => closeWorkbenchSessions(env, id, pairingId),
    },
  });
}
