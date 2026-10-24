// The worker's way into a design's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per design,
// its RPC methods with the design id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the design's own Durable Object the same call is a plain method call on the room itself (design-room.ts
// `localNamespace`), so code shared by the worker and the room (getDesign's outline, the room relays) costs no
// hop there.

import type { PhotoBlobMeta } from './db/photo-blobs';
import type { DesignCopy, DesignOutline } from './design-room/design-content';
import type { RouteIdentity } from './design-room/design-route';
import type { ThumbnailSubject } from './thumbnail';
import type { ShareAnswer, ShareMessage, SharedTabCopy } from '@liveworkspace/index-app';
import type { Env } from './types';

export type DesignRoomClient = {
  // The tabs (no bodies), slide deck and what the design knows of itself, for a design read.
  outline(): Promise<DesignOutline>;
  // One API request about this design, answered inside its Durable Object by the same handlers as before
  // (design-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The snapshot image a reader gets (thumbnail.ts), drawn where the content is.
  image(subject: ThumbnailSubject, tabId: string | null): Promise<string | null>;
  // Whether the design holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // Of `ids`, the photo blobs this tab holds, with what they are: the source side of an adoption into another
  // design (routes/photo-blob-routes.ts). The caller has checked the reader's grant on this design.
  heldBlobs(tabId: string, ids: string[]): Promise<PhotoBlobMeta[]>;
  // Whether the design places image `imageId` (on `onlyTabId`, for a tab-scoped reader) and may serve it
  // (db/image-grants.ts designServesImage). The caller has checked the reader's grant on this design.
  servesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (design-content.ts).
  exportCopy(onlyTabId: string | null, redactAuthorsFor: string | null): Promise<DesignCopy | null>;
  importCopy(copy: DesignCopy): Promise<void>;
  // The design is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
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
    image: (subject, tabId) => room.image(designId, subject, tabId),
    hasTab: (tabId) => room.hasTab(designId, tabId),
    heldBlobs: (tabId, ids) => room.heldBlobs(designId, tabId, ids),
    servesImage: (imageId, onlyTabId) => room.servesImage(designId, imageId, onlyTabId),
    exportCopy: (onlyTabId, redact) => room.exportCopy(designId, onlyTabId, redact),
    importCopy: (copy) => room.importCopy(designId, copy),
    purge: () => room.purge(designId),
    revokeCodes: (codes, reason) => room.revokeCodes(designId, codes, reason),
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
  image(designId: string, subject: ThumbnailSubject, tabId: string | null): Promise<string | null>;
  hasTab(designId: string, tabId: string): Promise<boolean>;
  heldBlobs(designId: string, tabId: string, ids: string[]): Promise<PhotoBlobMeta[]>;
  servesImage(designId: string, imageId: string, onlyTabId: string | null): Promise<boolean>;
  exportCopy(
    designId: string,
    onlyTabId: string | null,
    redact: string | null,
  ): Promise<DesignCopy | null>;
  importCopy(designId: string, copy: DesignCopy): Promise<void>;
  purge(designId: string): Promise<void>;
  revokeCodes(designId: string, codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
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
