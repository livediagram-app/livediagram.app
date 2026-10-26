// The index's grant on a document (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): a ten-minute token naming
// the document, the level and the tab, which the api and the document's room check offline. Held by
// @liveworkspace/index-client/browser's item grants: the editor asks for it while the document's code loads, keeps it
// until a minute before it lapses, and sends it with every request about that document as `X-Index-Grant` (apiFetch
// adds it, an image read through the document, `/api/images/<image>?d=<id>`, included), and on the room's upgrade as
// the ticket. One request per document and link per ten minutes; the open document's grant is fetched again a minute
// before it lapses, so a save never waits on it.

import { createItemGrants } from '@liveworkspace/index-client/browser';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';

export {
  GRANT_RENEW_BEFORE_MS,
  type ItemShare as DocumentShare,
} from '@liveworkspace/index-client/browser';

// The window global app/pre-hydration-scripts.ts DOCUMENT_GRANT_BOOT_SCRIPT leaves the early grant on.
export const DOCUMENT_GRANT_BOOT_GLOBAL = '__ldiaGrant';

const grants = createItemGrants({
  client: () => indexClient,
  bootGlobal: DOCUMENT_GRANT_BOOT_GLOBAL,
  itemsSegment: 'documents',
  queryItems: [{ segment: 'images', param: 'd' }],
});

/** A grant the editor already has (the create answers one), kept as if it had been fetched. */
export const seedDocumentGrant = grants.seed;
/** The grant on this document: held while it lasts, else one request shared by every caller meanwhile. Null when
 *  the index refuses (no access, a password needed) or cannot be reached. */
export const documentGrant = grants.grant;
/** The held grant, synchronously, while it has not lapsed: for the unload flush, which cannot wait for a request. */
export const heldDocumentGrant = grants.held;
/** Why the index last refused this document (`password_required`, `password_invalid`, `not_found`, ...), or null. */
export const documentGrantRefusal = grants.refusal;
/** Keeps the open document's grant fresh while it stays open; answers the stop. */
export const keepDocumentGrantFresh = grants.keepFresh;
/** `/api/documents/<id>[/...]`, or an image read through a document (`/api/images/<image>?d=<id>`): the id. */
export const documentIdOfPath = grants.itemIdOfPath;
/** Adds the document's grant to a request about one document that does not carry one already. */
export const withDocumentGrant = grants.withGrant;
export const resetDocumentGrantsForTests = grants.resetForTests;
