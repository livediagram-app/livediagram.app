// The worker's way into a document's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per document,
// its RPC methods with the document id filled in. Every content read and write goes through here.
//
// Inside the document's own Durable Object the same call is a plain method call on the room itself (document-room.ts
// `localNamespace`), so code shared by the worker and the room (getDocument's outline, the room relays) costs no
// hop there.

import type { DocumentCopy, DocumentOutline } from './document-room/document-content';
import type { DocumentFileImport } from './document-room/document-file';
import type { RouteIdentity } from './document-room/document-route';
import type {
  ExportQuery,
  ExportResult,
  ShareAnswer,
  ShareMessage,
  SharedTabCopy,
} from '@liveworkspace/index-app';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from './types';

export type DocumentRoomClient = {
  // The tabs (no bodies) and slide deck a document read carries.
  outline(): Promise<DocumentOutline>;
  // One API request about this document, answered inside its Durable Object by the same handlers as before
  // (document-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The document drawn for liveworkspace's previews (the export door, liveworkspace/docs/specs/006-media/previews.md), where the
  // content is.
  exportImage(query: ExportQuery): Promise<ExportResult>;
  // The document as its Drive file (the export door's `file` format, liveworkspace/docs/specs/005-drive/drive.md), and a new
  // document made from one (the import door).
  exportFile(query: ExportQuery): Promise<ExportResult>;
  importFile(file: DocumentFileImport): Promise<void>;
  // Whether the document holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // Whether the document places an image (on one tab, for a tab-scoped visitor) and may serve it: the byte
  // endpoint's share check.
  servesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (document-content.ts).
  // `copiedBy`: who copies; anyone but the owner takes other people's comment authors redacted.
  exportCopy(onlyTabId: string | null, copiedBy: string | null): Promise<DocumentCopy | null>;
  importCopy(copy: DocumentCopy): Promise<void>;
  // An old livediagram.app document's part, written with its own times (the migration door, docs/migration.md).
  importMigrated(payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  // The document is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  // Someone opened the document through a share link for the first time (the index's notice): the owner's
  // "someone joined" email, sent from the room, which keeps its once-per-window claim.
  joined(personId: string): Promise<void>;
  // A closed account's name off the document (document-anonymise.ts): answers the rows changed.
  anonymise(personId: string): Promise<number>;
  // A tab shared between documents (document-room/tab-shares.ts): the tab and its holders for one joining, the join
  // recorded, and what another holder (`from`) sends.
  sharedTabCopy(tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(tabId: string, member: string, seenUpdatedAt: number): Promise<boolean>;
  receiveShares(from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
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
    exportImage: (query) => room.exportImage(documentId, query),
    exportFile: (query) => room.exportFile(documentId, query),
    importFile: (file) => room.importFile(documentId, file),
    hasTab: (tabId) => room.hasTab(documentId, tabId),
    servesImage: (imageId, onlyTabId) => room.servesImage(documentId, imageId, onlyTabId),
    exportCopy: (onlyTabId, copiedBy) => room.exportCopy(documentId, onlyTabId, copiedBy),
    importCopy: (copy) => room.importCopy(documentId, copy),
    importMigrated: (payload) => room.importMigrated(documentId, payload),
    purge: () => room.purge(documentId),
    revokeCodes: (codes, reason) => room.revokeCodes(documentId, codes, reason),
    joined: (personId) => room.joined(documentId, personId),
    anonymise: (personId) => room.anonymise(documentId, personId),
    sharedTabCopy: (tabId) => room.sharedTabCopy(documentId, tabId),
    shareJoined: (tabId, member, seen) => room.shareJoined(documentId, tabId, member, seen),
    receiveShares: (from, messages) => room.receiveShares(documentId, from, messages),
  };
}

// The DocumentRoom RPC surface, by the document id each call names (the room checks it is its own).
export type DocumentRoomRpc = {
  outline(documentId: string): Promise<DocumentOutline>;
  route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  exportImage(documentId: string, query: ExportQuery): Promise<ExportResult>;
  exportFile(documentId: string, query: ExportQuery): Promise<ExportResult>;
  importFile(documentId: string, file: DocumentFileImport): Promise<void>;
  hasTab(documentId: string, tabId: string): Promise<boolean>;
  servesImage(documentId: string, imageId: string, onlyTabId: string | null): Promise<boolean>;
  exportCopy(
    documentId: string,
    onlyTabId: string | null,
    copiedBy: string | null,
  ): Promise<DocumentCopy | null>;
  importCopy(documentId: string, copy: DocumentCopy): Promise<void>;
  importMigrated(documentId: string, payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  purge(documentId: string): Promise<void>;
  revokeCodes(
    documentId: string,
    codes: string[],
    reason?: 'revoked' | 'rescoped',
  ): Promise<number>;
  joined(documentId: string, personId: string): Promise<void>;
  anonymise(documentId: string, personId: string): Promise<number>;
  sharedTabCopy(documentId: string, tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(
    documentId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean>;
  receiveShares(documentId: string, from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  fetch(request: Request): Promise<Response>;
};
