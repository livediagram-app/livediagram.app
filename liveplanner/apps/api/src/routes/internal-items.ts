// /api/internal/items/**: the One Explorer index's doors into a plan's content (docs/specs/015-api/api.md
// "Internal"), served by @liveworkspace/index-app's handleInternalItems with the app's key (INDEX_KEY). See it for
// the doors: a purge (one plan, or up to a hundred for a closed account), revoked links, notices for the emails,
// a copy into a new plan, and a workbench pairing's sessions closed in a plan's room (liveworkspace/docs/specs/011-workbench/workbench.md
// "Ending access").
//
// Each is a call to the plan's Durable Object (plan-client.ts). Where the plan is filed, its sharing and its
// Trash are the index's; a purge also drops the plan's previews at liveworkspace's media service (db/projects.ts
// `purgePlanPreviews`). The export door draws a plan for those previews (liveworkspace/docs/specs/006-media/previews.md), on the
// index's key or the media service's (MEDIA_KEY), and answers a plan's whole file for liveworkspace's Drive mirror, which
// calls it and the import door with DRIVE_KEY (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps",
// routes/internal-file.ts). A notice is worked out off the index's path: a share link made (the first-share milestone),
// or someone's first time in through a link (the owner's "someone joined" email, and Project·Joined).
import {
  JOINED_TELEMETRY_TYPE,
  checkMigrationTabSizes,
  handleInternalItems as handle,
} from '@liveworkspace/index-app';
import { MAX_TAB_BYTES } from '../limits';
import { notifyFirstShare } from '../email/notifications';
import { deleteAccount } from '../db/account';
import { purgePlanPreviews } from '../db/projects';
import { mediaClient, mediaOwner } from '../media';
import { planRoom } from '../plan-client';
import { closeWorkbenchSessions } from '../room-access-client';
import { reportServerEvent } from '../server-telemetry';
import { importProjectFileFor } from './internal-file';
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
    app: 'liveplanner',
    migrationKey: env.MIGRATION_KEY,
    waitUntil,
    handlers: {
      purge: async (id) => {
        await planRoom(env, id).purge();
        await purgePlanPreviews(env, id);
      },
      // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends
      // them away.
      // The plan drawn for liveworkspace's previews, or its whole file for the Drive mirror, by its Durable Object,
      // where the content is.
      export: (id, query) =>
        query.format === 'file'
          ? planRoom(env, id).exportFile(query)
          : planRoom(env, id).exportImage(query),
      // A new plan from a Drive file, as its owner's (routes/internal-file.ts).
      import: (input) => importProjectFileFor(env, input),
      revoke: (id, codes, reason) => planRoom(env, id).revokeCodes(codes, reason),
      // Someone's first time in through a link: the owner's email, and Project·Joined by the link's level.
      notice: (id, notice) =>
        notice.type === 'shared'
          ? notifyFirstShare(env, notice.actorId)
          : Promise.all([
              planRoom(env, id).joined(notice.personId),
              reportServerEvent(env, 'Project', 'Joined', JOINED_TELEMETRY_TYPE[notice.level]),
            ]),
      // A closed account, wherever it was closed: what liveplanner keeps for them beside their plans, and their name
      // off each plan of someone else's that names them.
      personClosed: (personId) => deleteAccount(env, personId),
      // A guest who became an account (accounts merged them; the index tells each app): the pictures they uploaded
      // for Image fields, in liveworkspace's media service, become the account's. A guest is named there by a hash
      // of this app and their id (media.ts mediaOwner), so only this app can ask. Their plans are the index's, and
      // the sender's hourly notification allowance at liveworkspace is a rolling window not worth carrying over.
      personMerged: async (guestId, userId) => {
        const media = mediaClient(env);
        if (!media) return;
        const merged = await media.mergeOwner(await mediaOwner(guestId), await mediaOwner(userId));
        if (!merged.ok)
          throw new Error(`media: merging the guest's images answered ${merged.status}`);
      },
      anonymise: (id, personId) => planRoom(env, id).anonymise(personId),
      // A workbench pairing's access ended at liveworkspace: its sockets in this plan's room close.
      // An old livediagram.app document's liveplanner part, into its plan's room (plan-room/plan-migration.ts). A tab
      // over the tab cap refuses the whole part (413) before the room is called.
      migrate: async (payload) => {
        checkMigrationTabSizes(payload, MAX_TAB_BYTES);
        return planRoom(env, payload.id).importMigrated(payload);
      },
      workbenchClose: (id, pairingId) => closeWorkbenchSessions(env, id, pairingId),
      copy: async (from, to, tabId) => {
        const copy = await planRoom(env, from).exportCopy(tabId, null);
        // No such plan, or no such tab in it.
        if (!copy || (tabId && copy.tabs.length === 0)) return 'not_found';
        // The target is a new plan: a copy into one that already holds this content fails its keys, and nothing
        // is written (importCopy is one transaction); the kit answers that as a conflict.
        await planRoom(env, to).importCopy(copy);
        return { tabs: copy.tabs.length, items: copy.items.length };
      },
    },
  });
}
