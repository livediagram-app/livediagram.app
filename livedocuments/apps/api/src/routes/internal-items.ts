// /api/internal/items/**: the One Explorer index's doors into a document's content (docs/specs/015-api/api.md
// "Internal"), served by @liveworkspace/index-app's handleInternalItems with the app's key (INDEX_KEY). See it for
// the doors: a purge (one document, or up to a hundred for a closed account), revoked links, notices for the emails,
// and a copy into a new document.
//
// Each is a call to the document's Durable Object (document-client.ts). Where the document is filed, its sharing and its
// Trash are the index's; a purge also drops what the api keeps about the document beside it (db/documents.ts
// `purgeDocumentRows`). A notice is worked out off the index's path: a share link made (the first-share milestone),
// or someone's first time in through a link (the owner's "someone joined" email).
import { handleInternalItems as handle } from '@liveworkspace/index-app';
import { notifyFirstShare } from '../email/notifications';
import { deleteAccount } from '../db/account';
import { purgeDocumentRows } from '../db/documents';
import { forgetImageRefs } from '../document-room/document-outbox';
import { mediaClient, mediaOwner } from '../media';
import { documentRoom } from '../document-client';
import type { Env } from '../types';

export function handleInternalItems(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  return handle(request, {
    key: env.INDEX_KEY,
    waitUntil,
    handlers: {
      purge: async (id) => {
        await documentRoom(env, id).purge();
        // The media service hears the document places nothing now, so an image only it placed can be swept.
        await Promise.all([purgeDocumentRows(env, id), forgetImageRefs(env, id)]);
      },
      // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends
      // them away.
      revoke: (id, codes, reason) => documentRoom(env, id).revokeCodes(codes, reason),
      notice: (id, notice) =>
        notice.type === 'shared'
          ? notifyFirstShare(env, notice.actorId)
          : documentRoom(env, id).joined(notice.personId),
      // A closed account, wherever it was closed: what livedocuments keeps for them beside their documents (their
      // images and their workbench), and their name off each document of someone else's that names them.
      personClosed: async (personId) => void (await deleteAccount(env, personId)),
      // A guest who became an account (accounts merged them; the index tells each app): their images in
      // liveworkspace's media service become the account's. A guest has no workbench (it needs a token).
      personMerged: async (guestId, userId) => {
        const media = mediaClient(env);
        if (!media) return;
        const merged = await media.mergeOwner(await mediaOwner(guestId), await mediaOwner(userId));
        if (!merged.ok)
          throw new Error(`media: merging the guest's images answered ${merged.status}`);
      },
      anonymise: (id, personId) => documentRoom(env, id).anonymise(personId),
      copy: async (from, to, tabId) => {
        const copy = await documentRoom(env, from).exportCopy(tabId, null);
        // No such document, or no such tab in it.
        if (!copy || (tabId && copy.tabs.length === 0)) return 'not_found';
        // The target is a new document: a copy into one that already holds this content fails its keys, and nothing
        // is written (importCopy is one transaction); the kit answers that as a conflict. The copy carries a grant for
        // each image its source could serve, so it serves them too (docs/specs/009-elements/images.md).
        await documentRoom(env, to).importCopy(copy);
        return { tabs: copy.tabs.length, items: 0 };
      },
    },
  });
}
