// /api/internal/items/**: the One Explorer index's doors into a design's content (docs/specs/015-api/api.md
// "Internal"), served by @liveworkspace/index-app's handleInternalItems with the app's key (INDEX_KEY). See it for
// the doors: a purge (one design, or up to a hundred for a closed account), revoked links, notices for the emails,
// a copy into a new design, and a workbench pairing's sessions closed in a design's room
// (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access").
//
// Each is a call to the design's Durable Object (design-client.ts). Where the design is filed, its sharing and its
// Trash are the index's; a purge also drops the design's previews in liveworkspace's media service
// (liveworkspace/docs/specs/006-media/previews.md "Purging"). A notice is worked out off the index's path: a share link made (the
// first-share milestone), or someone's first time in through a link (the owner's "someone joined" email). The export
// door draws the design for liveworkspace's previews, which call it with MEDIA_KEY, and answers its whole file for
// liveworkspace's Drive mirror, which calls it and the import door with DRIVE_KEY (liveworkspace/docs/specs/005-drive/drive.md
// "Contracts > The apps", routes/internal-file.ts).
import {
  JOINED_TELEMETRY_TYPE,
  checkMigrationTabSizes,
  handleInternalItems as handle,
} from '@liveworkspace/index-app';
import { MAX_TAB_BYTES } from '../limits';
import { communityService } from '../community-service';
import { notifyFirstShare } from '../email/notifications';
import { deleteAccount } from '../db/account';
import { mergeMediaOwner } from '../media';
import { purgeDesignPreviews } from '../db/designs';
import { designRoom } from '../design-client';
import { closeWorkbenchSessions } from '../room-access-client';
import { reportServerEvent } from '../server-telemetry';
import { importDesignFileFor } from './internal-file';
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
    app: 'livedesign',
    migrationKey: env.MIGRATION_KEY,
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
      // liveworkspace's media service and their Community copies become the account's. A guest has no workbench (it
      // needs a token), and their designs are the index's to move.
      personMerged: async (guestId, userId) => {
        await mergeMediaOwner(env, guestId, userId);
        await communityService.mergeCopier(env, guestId, userId);
      },
      anonymise: (id, personId) => designRoom(env, id).anonymise(personId),
      // A workbench pairing's access ended at liveworkspace: its sockets in this design's room close.
      // An old livediagram.app document's livedesign part, into its design's room (design-room/design-migration.ts). A tab
      // over the tab cap refuses the whole part (413) before the room is called.
      migrate: async (payload) => {
        checkMigrationTabSizes(payload, MAX_TAB_BYTES);
        return designRoom(env, payload.id).importMigrated(payload);
      },
      workbenchClose: (id, pairingId) => closeWorkbenchSessions(env, id, pairingId),
      copy: async (from, to, tabId, copier) => {
        // The source as the copier may take it: anyone but the owner takes the comments as the tab read serves them;
        // through the design's Community post's link, without its comments or the people on its actions.
        const source = await designRoom(env, from).exportCopy(tabId, copier);
        // No such design, or no such tab in it.
        if (!source || (tabId && source.copy.tabs.length === 0)) return 'not_found';
        const { copy } = source;
        // The target is a new design: a copy into one that already holds this content fails its keys, and nothing
        // is written (importCopy is one transaction); the kit answers that as a conflict.
        await designRoom(env, to).importCopy(copy);
        // A copy through a Community post's link counts toward the post (docs/specs/025-community/community.md
        // "Likes, reports and moderation"), once per copier and at most a few from one network: the copier's address
        // as the index saw it (an Explorer's copy). The api's own copy door counted it first
        // (routes/design-index-routes.ts), so this adds nothing then. An index that names no address counts the
        // copier as their own network.
        if (source.community && copier.by)
          waitUntil(
            communityService.countCopy(env, from, copier.by, copier.ip ?? `copier:${copier.by}`),
          );
        return { tabs: copy.tabs.length, items: 0 };
      },
      // The design drawn, for liveworkspace's previews (design-room.ts `exportImage`), or its whole file, for the
      // Drive mirror (`exportFile`).
      export: (id, query) =>
        query.format === 'file'
          ? designRoom(env, id).exportFile(query)
          : designRoom(env, id).exportImage(query),
      // A new design from a Drive file, as its owner's (routes/internal-file.ts).
      import: (input) => importDesignFileFor(env, input),
    },
  });
}
