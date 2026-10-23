// The worker's way into a document's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per document,
// its RPC methods with the document id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the document's own Durable Object the same call is a plain method call on the room itself (document-room.ts
// `localNamespace`), so code shared by the worker and the room (getDocument's outline, the room relays) costs no
// hop there.

import type { DocumentCopy, DocumentOutline } from './document-room/document-content';
import type { RouteIdentity } from './document-room/document-route';
import type { ThumbnailSubject } from './thumbnail';
import type { Env } from './types';

export type DocumentRoomClient = {
  // The tabs (no bodies) and slide deck a document read carries.
  outline(): Promise<DocumentOutline>;
  // One API request about this document, answered inside its Durable Object by the same handlers as before
  // (document-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The snapshot image a reader gets (thumbnail.ts), drawn where the content is.
  image(
    subject: ThumbnailSubject,
    tabId: string | null,
    community?: boolean,
  ): Promise<string | null>;
  // Whether the document holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // Whether the document places an image (on one tab, for a tab-scoped visitor): the byte endpoint's share check.
  placesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (document-content.ts).
  exportCopy(
    onlyTabId: string | null,
    redactAuthorsFor: string | null,
    redactForCommunity?: boolean,
  ): Promise<DocumentCopy | null>;
  importCopy(copy: DocumentCopy): Promise<void>;
  // The document is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[]): Promise<number>;
};

export function documentRoom(
  env: Pick<Env, 'DOCUMENT_ROOM'>,
  documentId: string,
): DocumentRoomClient {
  const ns = env.DOCUMENT_ROOM;
  const stub = ns.get(ns.idFromName(documentId));
  // The stub's RPC types wrap every answer for the wire; the shapes here are the class's own.
  const room = stub as unknown as DocumentRoomRpc;
  return {
    outline: () => room.outline(documentId),
    route: (request, identity) => room.route(documentId, request, identity),
    image: (subject, tabId, community = false) => room.image(documentId, subject, tabId, community),
    hasTab: (tabId) => room.hasTab(documentId, tabId),
    placesImage: (imageId, onlyTabId) => room.placesImage(documentId, imageId, onlyTabId),
    exportCopy: (onlyTabId, redact, community = false) =>
      room.exportCopy(documentId, onlyTabId, redact, community),
    importCopy: (copy) => room.importCopy(documentId, copy),
    purge: () => room.purge(documentId),
    revokeCodes: (codes) => room.revokeCodes(documentId, codes),
  };
}

// The DocumentRoom RPC surface, by the document id each call names (the room checks it is its own).
export type DocumentRoomRpc = {
  outline(documentId: string): Promise<DocumentOutline>;
  route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  image(
    documentId: string,
    subject: ThumbnailSubject,
    tabId: string | null,
    community: boolean,
  ): Promise<string | null>;
  hasTab(documentId: string, tabId: string): Promise<boolean>;
  placesImage(documentId: string, imageId: string, onlyTabId: string | null): Promise<boolean>;
  exportCopy(
    documentId: string,
    onlyTabId: string | null,
    redact: string | null,
    community: boolean,
  ): Promise<DocumentCopy | null>;
  importCopy(documentId: string, copy: DocumentCopy): Promise<void>;
  purge(documentId: string): Promise<void>;
  revokeCodes(documentId: string, codes: string[]): Promise<number>;
  fetch(request: Request): Promise<Response>;
};
