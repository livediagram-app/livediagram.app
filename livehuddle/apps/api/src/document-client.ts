// The worker's way into a document's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per document,
// its RPC methods with the document id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the document's own Durable Object the same call is a plain method call on the room itself (document-room.ts
// `localNamespace`), so code shared by the worker and the room (getDocument's outline, the room relays) costs no
// hop there.

import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationTargetDescription,
} from '@liveworkspace/index-client';
import type { AccessLevel, CommunityAuthor } from '@livehuddle/api-schema';
import type { HookAnswer, HookCall } from '@liveworkspace/automations/room';
import type {
  Copier,
  ExportCommentsResult,
  ExportQuery,
  ExportResult,
  PutAwayRefusal,
  StandingGrant,
} from '@liveworkspace/index-app';
import type { DocumentCopy, DocumentOutline } from './document-room/document-content';
import type { DocumentFileImport } from './document-room/document-file';
import type { RouteIdentity } from './document-room/document-route';
import type { ShareAnswer, ShareMessage, SharedTabCopy } from './document-room/tab-shares';
import type { HearingAnswer, HearingAsk } from './calls/room-calls';
import type { CallAdmission, CallMinutesReading, CallsPayer } from './calls/call-meter';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite, ItemStanding } from '@liveworkspace/index-client';
import type { Env } from './types';

export type CopySource = { copy: DocumentCopy; community: boolean };

// Whoever asked for access, as the index's notice names them.
export type AccessRequester = { id: string; name: string | null; requestId?: string };

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
  // Every comment thread in the Space, its authors unredacted (the export door's `comments` format, for the data
  // export: liveworkspace/docs/specs/003-accounts/data-export.md).
  exportComments(): Promise<ExportCommentsResult>;
  // Whether the document holds this tab.
  hasTab(tabId: string): Promise<boolean>;
  // Whether the document places an image (on one tab, for a tab-scoped visitor) and may serve it: the byte
  // endpoint's share check.
  servesImage(imageId: string, onlyTabId: string | null): Promise<boolean>;
  // A copy's two halves (document-content.ts): the source as `copier` may take it, and whether it went through the
  // canvas's open Community post's link.
  exportCopy(onlyTabId: string | null, copier: Copier | null): Promise<CopySource | null>;
  importCopy(copy: DocumentCopy): Promise<void>;
  // An old livehuddle.app document's part, written with its own times (the migration door, docs/migration.md).
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
  joined(personId: string, level?: AccessLevel): Promise<void>;
  // Someone asked for access to the Space (the index's notice): Access Requested, for the rules that hear it.
  accessRequested(requester: AccessRequester): Promise<void>;
  // Automations' doors (@liveworkspace/automations/room doors.ts): an Incoming Webhook call to one rule, and a
  // rule email's unsubscribe (false for a token the Space never made).
  incomingHook(ruleId: string, call: HookCall): Promise<HookAnswer>;
  // A rule's step from another app on this item, its author's grant checked (cross-app-door.ts), and what
  // the step's pickers may name here.
  automationStep(call: AutomationStepDoorCall): Promise<AutomationStepAnswer>;
  automationTarget(): Promise<Omit<AutomationTargetDescription, 'app' | 'title'>>;
  emailOptOut(token: string): Promise<boolean>;
  // Where the Space stands at the index (@liveworkspace/automations/room standing.ts): put away, its rules run nothing.
  takeStanding(standing: ItemStanding): Promise<void>;
  // Whether the room refuses a grant as put away (Work Tracker 1323): the room-ticket door asks.
  standingRefusal(grant: StandingGrant): Promise<PutAwayRefusal | null>;
  // A closed account's name off the canvas (document-anonymise.ts), and the guests it signed in from off its
  // Attendance (`guestKeys`, their collab keys) and as its own (`guestIds`, the index's): answers the rows changed.
  anonymise(
    personId: string,
    guestKeys?: readonly string[],
    guestIds?: readonly string[],
  ): Promise<number>;
  // The index's reverse write of a connected tab (document-room/connected-tab.ts).
  addConnectedTab(write: ConnectedTabWrite): Promise<ConnectedTabOutcome>;
  // A tab shared between documents (document-room/tab-shares.ts): the tab and its holders for one joining, the
  // join recorded, and what another holder (`from`) sends.
  sharedTabCopy(tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(tabId: string, member: string, seenUpdatedAt: number): Promise<boolean>;
  receiveShares(from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  // The calls mint route's question (calls/room-calls.ts, #483): may this call session receive these tracks now?
  callsHearing(subscriberSession: string, asks: HearingAsk[]): Promise<HearingAnswer[]>;
  // Call Minutes (calls/call-meter.ts, docs/specs/012-collaboration/call-minutes.md), asked only with Pro on: may a
  // join go ahead for the Space's owner, and the owner's month as the room knows it.
  callsAdmit(owner: CallsPayer): Promise<CallAdmission>;
  callMinutes(owner: CallsPayer): Promise<CallMinutesReading | null>;
  // Whether the owner's month is used, for the calls routes that ask the room nothing else (a publish, a
  // renegotiation, a layer switch).
  callsPaused(): Promise<boolean>;
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
    exportComments: () => room.exportComments(documentId),
    hasTab: (tabId) => room.hasTab(documentId, tabId),
    addConnectedTab: (write) => room.addConnectedTab(documentId, write),
    servesImage: (imageId, onlyTabId) => room.servesImage(documentId, imageId, onlyTabId),
    exportCopy: (onlyTabId, copier) => room.exportCopy(documentId, onlyTabId, copier),
    importCopy: (copy) => room.importCopy(documentId, copy),
    importMigrated: (payload) => room.importMigrated(documentId, payload),
    purge: () => room.purge(documentId),
    revokeCodes: (codes, reason) => room.revokeCodes(documentId, codes, reason),
    community: () => room.community(documentId),
    communityPostTitle: (code) => room.communityPostTitle(documentId, code),
    communityListing: (code) => room.communityListing(documentId, code),
    joined: (personId, level) => room.joined(documentId, personId, level),
    accessRequested: (requester) => room.accessRequested(documentId, requester),
    incomingHook: (ruleId, call) => room.incomingHook(documentId, ruleId, call),
    automationStep: (call) => room.automationStep(documentId, call),
    automationTarget: () => room.automationTarget(documentId),
    emailOptOut: (token) => room.emailOptOut(documentId, token),
    takeStanding: (standing) => room.takeStanding(documentId, standing),
    standingRefusal: (grant) => room.takeGrantStanding(grant),
    anonymise: (personId, guestKeys = [], guestIds = []) =>
      room.anonymise(documentId, personId, guestKeys, guestIds),
    sharedTabCopy: (tabId) => room.sharedTabCopy(documentId, tabId),
    shareJoined: (tabId, member, seen) => room.shareJoined(documentId, tabId, member, seen),
    receiveShares: (from, messages) => room.receiveShares(documentId, from, messages),
    callsHearing: (subscriber, asks) => room.callsHearing(documentId, subscriber, asks),
    callsAdmit: (owner) => room.callsAdmit(documentId, owner),
    callMinutes: (owner) => room.callMinutes(documentId, owner),
    callsPaused: () => room.callsPaused(documentId),
  };
}

// The DocumentRoom RPC surface, by the document id each call names (the room checks it is its own).
export type DocumentRoomRpc = {
  outline(documentId: string): Promise<DocumentOutline>;
  route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  exportImage(documentId: string, query: ExportQuery): Promise<ExportResult>;
  exportFile(documentId: string, query: ExportQuery): Promise<ExportResult>;
  importFile(documentId: string, file: DocumentFileImport): Promise<void>;
  exportComments(documentId: string): Promise<ExportCommentsResult>;
  hasTab(documentId: string, tabId: string): Promise<boolean>;
  addConnectedTab(documentId: string, write: ConnectedTabWrite): Promise<ConnectedTabOutcome>;
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
  joined(documentId: string, personId: string, level?: AccessLevel): Promise<void>;
  accessRequested(documentId: string, requester: AccessRequester): Promise<void>;
  incomingHook(documentId: string, ruleId: string, call: HookCall): Promise<HookAnswer>;
  automationStep(documentId: string, call: AutomationStepDoorCall): Promise<AutomationStepAnswer>;
  automationTarget(documentId: string): Promise<Omit<AutomationTargetDescription, 'app' | 'title'>>;
  emailOptOut(documentId: string, token: string): Promise<boolean>;
  takeStanding(documentId: string, standing: ItemStanding): Promise<void>;
  takeGrantStanding(grant: StandingGrant): Promise<PutAwayRefusal | null>;
  anonymise(
    documentId: string,
    personId: string,
    guestKeys: readonly string[],
    guestIds: readonly string[],
  ): Promise<number>;
  sharedTabCopy(documentId: string, tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(
    documentId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean>;
  receiveShares(documentId: string, from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  callsHearing(
    documentId: string,
    subscriberSession: string,
    asks: HearingAsk[],
  ): Promise<HearingAnswer[]>;
  callsAdmit(documentId: string, owner: CallsPayer): Promise<CallAdmission>;
  callMinutes(documentId: string, owner: CallsPayer): Promise<CallMinutesReading | null>;
  callsPaused(documentId: string): Promise<boolean>;
  fetch(request: Request): Promise<Response>;
};
