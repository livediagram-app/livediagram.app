// The worker's way into a document's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per document,
// its RPC methods with the document id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the document's own Durable Object the same call is a plain method call on the room itself (document-room.ts
// `localNamespace`), so code shared by the worker and the room (getDocument's outline, the room relays) costs no
// hop there.

import type { CommunityAuthor } from '@livediagram/api-schema';
import type { Copier, ExportQuery, ExportResult } from '@liveworkspace/index-app';
import type { notifyActionAssigned, notifyMentioned } from './email/notifications';
import type { DocumentCopy, DocumentOutline } from './document-room/document-content';
import type { DocumentFileImport } from './document-room/document-file';
import type { RouteIdentity } from './document-room/document-route';
import type { ShareAnswer, ShareMessage, SharedTabCopy } from './document-room/tab-shares';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from './types';

// What the canvas's action-assigned and mention emails are told (email/notifications.ts): all but the canvas,
// which the canvas names itself.
export type ActionNotice = Omit<Parameters<typeof notifyActionAssigned>[1], 'document'>;
export type MentionNotice = Omit<Parameters<typeof notifyMentioned>[1], 'document'>;

export type CopySource = { copy: DocumentCopy; community: boolean };

export type DocumentRoomClient = {
  // The tabs (no bodies) and slide deck a document read carries.
  outline(): Promise<DocumentOutline>;
  // One API request about this document, answered inside its Durable Object by the same handlers as before
  // (document-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The canvas drawn for liveworkspace's previews (the export door, liveworkspace/docs/specs/006-media/previews.md), where the
  // content is.
  exportImage(query: ExportQuery): Promise<ExportResult>;
  // The canvas as its Drive file (the export door's `file` format, liveworkspace/docs/specs/005-drive/drive.md), and a new canvas
  // made from one (the import door).
  exportFile(query: ExportQuery): Promise<ExportResult>;
  importFile(file: DocumentFileImport): Promise<void>;
  // Whether the document holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // Whether the document places an image (on one tab, for a tab-scoped visitor) and may serve it: the byte
  // endpoint's share check.
  servesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (document-content.ts): the source as `copier` may take it, and whether it went through the
  // canvas's open Community post's link.
  exportCopy(onlyTabId: string | null, copier: Copier | null): Promise<CopySource | null>;
  importCopy(copy: DocumentCopy): Promise<void>;
  // An old livediagram.app document's part, written with its own times (the migration door, docs/migration.md).
  importMigrated(payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  // The document is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked or rescoped elsewhere (the index): their sessions end now, or reload into what the link
  // opens now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  // The canvas's Community post's link (its code, and whether it opens the canvas now), or null for none.
  community(): Promise<{ code: string; open: boolean } | null>;
  // The post's title when `code` is its open link: what a copy through it is named.
  communityPostTitle(code: string): Promise<string | null>;
  // The post's id and author, for a visitor through its open link; null otherwise.
  communityListing(code: string): Promise<{ postId: string; author: CommunityAuthor } | null>;
  // Someone opened the canvas through a share link for the first time (the index's notice): the owner's email.
  joined(personId: string): Promise<void>;
  // A closed account's name off the canvas (document-anonymise.ts): answers the rows changed.
  anonymise(personId: string): Promise<number>;
  // The emails of an action assigned and of a comment's mentions (routes/team-notify-routes.ts, which checked the
  // people and the canvas): sent from the canvas, which keeps their once-only claims. False for a canvas not
  // started.
  notifyAction(input: ActionNotice): Promise<boolean>;
  notifyMention(input: MentionNotice): Promise<boolean>;
  // A tab shared between documents (document-room/tab-shares.ts): the tab and its holders for one joining, the
  // join recorded, and what another holder (`from`) sends.
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
    exportCopy: (onlyTabId, copier) => room.exportCopy(documentId, onlyTabId, copier),
    importCopy: (copy) => room.importCopy(documentId, copy),
    importMigrated: (payload) => room.importMigrated(documentId, payload),
    purge: () => room.purge(documentId),
    revokeCodes: (codes, reason) => room.revokeCodes(documentId, codes, reason),
    community: () => room.community(documentId),
    communityPostTitle: (code) => room.communityPostTitle(documentId, code),
    communityListing: (code) => room.communityListing(documentId, code),
    joined: (personId) => room.joined(documentId, personId),
    anonymise: (personId) => room.anonymise(documentId, personId),
    notifyAction: (input) => room.notifyAction(documentId, input),
    notifyMention: (input) => room.notifyMention(documentId, input),
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
    copier: Copier | null,
  ): Promise<CopySource | null>;
  importCopy(documentId: string, copy: DocumentCopy): Promise<void>;
  importMigrated(documentId: string, payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  purge(documentId: string): Promise<void>;
  revokeCodes(
    documentId: string,
    codes: string[],
    reason?: 'revoked' | 'rescoped',
  ): Promise<number>;
  community(documentId: string): Promise<{ code: string; open: boolean } | null>;
  communityPostTitle(documentId: string, code: string): Promise<string | null>;
  communityListing(
    documentId: string,
    code: string,
  ): Promise<{ postId: string; author: CommunityAuthor } | null>;
  joined(documentId: string, personId: string): Promise<void>;
  anonymise(documentId: string, personId: string): Promise<number>;
  notifyAction(documentId: string, input: ActionNotice): Promise<boolean>;
  notifyMention(documentId: string, input: MentionNotice): Promise<boolean>;
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
