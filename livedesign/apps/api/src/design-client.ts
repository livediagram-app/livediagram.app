// The worker's way into a design's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per design,
// its RPC methods with the design id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the design's own Durable Object the same call is a plain method call on the room itself (design-room.ts
// `localNamespace`), so code shared by the worker and the room (getDesign's outline, the room relays) costs no
// hop there.

import type { PhotoBlobMeta } from './db/photo-blobs';
import type { CommunityShareInfo } from '@livedesign/api-schema';
import type { DesignCopy, DesignOutline } from './design-room/design-content';
import type { DesignFileImport } from './design-room/design-file';
import type { RouteIdentity } from './design-room/design-route';
import type {
  Copier,
  ExportCommentsResult,
  ExportQuery,
  ExportResult,
  ShareAnswer,
  ShareMessage,
  SharedTabCopy,
} from '@liveworkspace/index-app';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import type { Env } from './types';

// The source side of a copy, and whether it went through the design's open Community post's link.
export type CopySource = { copy: DesignCopy; community: boolean };

// The Community post a visitor through its open link is told of: its id at the service and who it shows as author.
export type CommunityListing = CommunityShareInfo;

export type DesignRoomClient = {
  // The tabs (no bodies) and what the design knows of itself, for a design read.
  outline(): Promise<DesignOutline>;
  // One API request about this design, answered inside its Durable Object by the same handlers as before
  // (design-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The design drawn for liveworkspace's previews (the export door, liveworkspace/docs/specs/006-media/previews.md), where the
  // content is.
  exportImage(query: ExportQuery): Promise<ExportResult>;
  // The design as its Drive file (the export door's `file` format, liveworkspace/docs/specs/005-drive/drive.md), and a new design
  // made from one (the import door).
  exportFile(query: ExportQuery): Promise<ExportResult>;
  importFile(file: DesignFileImport): Promise<void>;
  // Every comment thread in the design, its authors unredacted (the export door's `comments` format, for the data
  // export: liveworkspace/docs/specs/003-accounts/data-export.md).
  exportComments(): Promise<ExportCommentsResult>;
  // Whether the design holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // Of `ids`, the photo blobs this tab holds, with what they are: the source side of an adoption into another
  // design (routes/photo-blob-routes.ts). The caller has checked the reader's grant on this design.
  heldBlobs(tabId: string, ids: string[]): Promise<PhotoBlobMeta[]>;
  // Whether the design places image `imageId` (on `onlyTabId`, for a tab-scoped reader) and may serve it
  // (db/image-grants.ts designServesImage). The caller has checked the reader's grant on this design.
  servesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (design-content.ts): the source as `copier` may take it (anyone but the owner takes the
  // comments without other people's author ids), and whether it went through the design's open Community post's link.
  exportCopy(onlyTabId: string | null, copier: Copier | null): Promise<CopySource | null>;
  importCopy(copy: DesignCopy): Promise<void>;
  // An old livediagram.app document's part, written with its own times (the migration door, docs/migration.md).
  importMigrated(payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  // The design is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  // The design's Community post's link (its code, and whether it opens the design now), or null for none.
  community(): Promise<{ code: string; open: boolean } | null>;
  // The post's title when `code` is its open link: what a copy through it is named.
  communityPostTitle(code: string): Promise<string | null>;
  // The post's id and author, for a visitor through its open link; null otherwise.
  communityListing(code: string): Promise<CommunityListing | null>;
  // Someone opened the design through a share link for the first time (the index's notice): the owner's
  // "someone joined" email, sent from the room, which keeps its once-per-window claim.
  joined(personId: string): Promise<void>;
  // A closed account's name off the design (design-anonymise.ts): answers the rows changed.
  anonymise(personId: string): Promise<number>;
  // A tab shared between designs (design-room/tab-shares.ts): the tab and its holders for one joining, the join
  // recorded, and what another holder (`from`) sends.
  sharedTabCopy(tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(tabId: string, member: string, seenUpdatedAt: number): Promise<boolean>;
  receiveShares(from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
};

export function designRoom(env: Pick<Env, 'DESIGN_ROOM'>, designId: string): DesignRoomClient {
  const ns = env.DESIGN_ROOM;
  const stub = ns.get(ns.idFromName(designId));
  // The stub's RPC types wrap every answer for the wire; the shapes here are the class's own.
  const room = stub as unknown as DesignRoomRpc;
  return {
    outline: () => room.outline(designId),
    route: (request, identity) => room.route(designId, request, identity),
    exportImage: (query) => room.exportImage(designId, query),
    exportFile: (query) => room.exportFile(designId, query),
    importFile: (file) => room.importFile(designId, file),
    exportComments: () => room.exportComments(designId),
    hasTab: (tabId) => room.hasTab(designId, tabId),
    heldBlobs: (tabId, ids) => room.heldBlobs(designId, tabId, ids),
    servesImage: (imageId, onlyTabId) => room.servesImage(designId, imageId, onlyTabId),
    exportCopy: (onlyTabId, copier) => room.exportCopy(designId, onlyTabId, copier),
    importCopy: (copy) => room.importCopy(designId, copy),
    importMigrated: (payload) => room.importMigrated(designId, payload),
    purge: () => room.purge(designId),
    revokeCodes: (codes, reason) => room.revokeCodes(designId, codes, reason),
    community: () => room.community(designId),
    communityPostTitle: (code) => room.communityPostTitle(designId, code),
    communityListing: (code) => room.communityListing(designId, code),
    joined: (personId) => room.joined(designId, personId),
    anonymise: (personId) => room.anonymise(designId, personId),
    sharedTabCopy: (tabId) => room.sharedTabCopy(designId, tabId),
    shareJoined: (tabId, member, seen) => room.shareJoined(designId, tabId, member, seen),
    receiveShares: (from, messages) => room.receiveShares(designId, from, messages),
  };
}

// The DesignRoom RPC surface, by the design id each call names (the room checks it is its own).
export type DesignRoomRpc = {
  outline(designId: string): Promise<DesignOutline>;
  route(designId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  exportImage(designId: string, query: ExportQuery): Promise<ExportResult>;
  exportFile(designId: string, query: ExportQuery): Promise<ExportResult>;
  importFile(designId: string, file: DesignFileImport): Promise<void>;
  exportComments(designId: string): Promise<ExportCommentsResult>;
  hasTab(designId: string, tabId: string): Promise<boolean>;
  heldBlobs(designId: string, tabId: string, ids: string[]): Promise<PhotoBlobMeta[]>;
  servesImage(designId: string, imageId: string, onlyTabId: string | null): Promise<boolean>;
  exportCopy(
    designId: string,
    onlyTabId: string | null,
    copier: Copier | null,
  ): Promise<CopySource | null>;
  importCopy(designId: string, copy: DesignCopy): Promise<void>;
  importMigrated(designId: string, payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  purge(designId: string): Promise<void>;
  revokeCodes(designId: string, codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  community(designId: string): Promise<{ code: string; open: boolean } | null>;
  communityPostTitle(designId: string, code: string): Promise<string | null>;
  communityListing(designId: string, code: string): Promise<CommunityListing | null>;
  joined(designId: string, personId: string): Promise<void>;
  anonymise(designId: string, personId: string): Promise<number>;
  sharedTabCopy(designId: string, tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(
    designId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean>;
  receiveShares(designId: string, from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  fetch(request: Request): Promise<Response>;
};
