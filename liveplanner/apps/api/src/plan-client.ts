// The worker's way into a plan's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per plan,
// its RPC methods with the plan id filled in. Every content read and write goes through here.
//
// Inside the plan's own Durable Object the same call is a plain method call on the room itself (plan-room.ts
// `localNamespace`), so code shared by the worker and the room (getProject's outline, the room relays) costs no
// hop there.

import type { Item } from '@liveplanner/items';
import type { CardThread } from '@liveplanner/project';
import type { ThreadOp, ThreadsRelay, ThreadWriteResult } from './plan-room/card-thread-store';
import type { PlanCopy, PlanOutline } from './plan-room/plan-content';
import type { CommunityShareInfo } from '@liveplanner/api-schema';
import type { Copier } from '@liveworkspace/index-app';
import type { RouteIdentity } from './plan-room/plan-route';
import type { HookAnswer, HookCall } from './plan-room/automations/automation-incoming';
import type { GithubRoomAnswer, GithubRoomCall } from './plan-room/github/github-room';
import type { ProjectFileImport } from './plan-room/project-file';
import type {
  ExportCommentsResult,
  ExportQuery,
  ExportResult,
  ExportTablesResult,
  ShareAnswer,
  ShareMessage,
  SharedTabCopy,
} from '@liveworkspace/index-app';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import type { Env } from './types';

// The source side of a copy, and whether it went through the plan's open Community post's link.
export type CopySource = { copy: PlanCopy; community: boolean };

// The Community post a visitor through its open link is told of: its id at the service and who it shows as author.
export type CommunityListing = CommunityShareInfo;

// The plan's Community post's link as the doors read it: its code, and whether it opens the plan now.
export type CommunityLink = { code: string; open: boolean };

export type PlanRoomClient = {
  // The tabs (no bodies) and type catalogue a project read carries.
  outline(): Promise<PlanOutline>;
  // One API request about this plan, answered inside its Durable Object by the same handlers as before
  // (plan-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The plan drawn for liveworkspace's previews (the export door, plan-room.ts `exportImage`), where the content is.
  exportImage(query: ExportQuery): Promise<ExportResult>;
  // The plan as its Drive file (the export door's `file` format, liveworkspace/docs/specs/005-drive/drive.md), and a new plan made
  // from one (the import door).
  exportFile(query: ExportQuery): Promise<ExportResult>;
  importFile(file: ProjectFileImport): Promise<void>;
  // The plan for liveworkspace's data export (the export door's `csv` and `comments` formats, plan-room/plan-export.ts):
  // its boards and Sheets as CSV, and every comment thread with its real authors.
  exportTables(): Promise<ExportTablesResult>;
  exportComments(): Promise<ExportCommentsResult>;
  // Whether the plan holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // The index's reverse write of a connected tab (plan-room/connected-tab.ts).
  addConnectedTab(write: ConnectedTabWrite): Promise<ConnectedTabOutcome>;
  // One card, by id (a mention email reads the comment from the card itself).
  item(itemId: string): Promise<Item | null>;
  // Image fields (plan-room/image-grants.ts): a picture uploaded for this plan recorded as one it may serve, and
  // whether it serves one now (to a tab-scoped reader, `tabScope`, only through a card its tab shows).
  grantImage(imageId: string): Promise<void>;
  servesImage(imageId: string, tabScope: string | null): Promise<boolean>;
  // Which of these pictures the plan holds a grant for: the ones an agent may place on its cards.
  grantedImages(imageIds: readonly string[]): Promise<string[]>;
  // A copy's two halves (plan-content.ts): the source as `copier` may take it (anyone but the owner takes the
  // comments without other people's author ids), and whether it went through the plan's open Community post's link.
  exportCopy(onlyTabId: string | null, copier: Copier | null): Promise<CopySource | null>;
  importCopy(copy: PlanCopy): Promise<void>;
  // An old livediagram.app document's part, written with its own times (the migration door, docs/migration.md).
  importMigrated(payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  // The plan is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  // The plan's Community post's link (its code, and whether it opens the plan now), or null for none.
  community(): Promise<CommunityLink | null>;
  // The post's title when `code` is its open link: what a copy through it is named.
  communityPostTitle(code: string): Promise<string | null>;
  // The post's id and author, for a visitor through its open link; null otherwise.
  communityListing(code: string): Promise<CommunityListing | null>;
  // Someone opened the plan through a share link for the first time (the index's notice): the owner's
  // "someone joined" email, sent from the room, which keeps its once-per-window claim.
  joined(personId: string): Promise<void>;
  // A closed account's name off the plan (plan-anonymise.ts): answers the rows changed.
  anonymise(personId: string): Promise<number>;
  // A tab shared between plans (plan-room/tab-shares.ts): the tab and its holders for one joining, the join
  // recorded, and what another holder (`from`) sends.
  sharedTabCopy(tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(tabId: string, member: string, seenUpdatedAt: number): Promise<boolean>;
  receiveShares(from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  // A card's comment threads across plans (plan-room/card-thread-store.ts): on the home, the threads of `ids` that
  // list a card of plan `via`, and one write on one made through `via`; on a plan holding a card, another plan's
  // write relayed (answering the threads it holds no link to).
  threadsFor(ids: string[], via: string): Promise<CardThread[]>;
  threadWrite(threadId: string, op: ThreadOp, via: string): Promise<ThreadWriteResult>;
  threadsRelayed(relay: ThreadsRelay): Promise<string[]>;
  // An Incoming Webhook call to one of the plan's rules (plan-room/automations/automation-incoming.ts): the room checks
  // the secret, the limits and the body, and queues the runs. An id nothing has written answers 401 and stays empty.
  incomingHook(ruleId: string, call: HookCall): Promise<HookAnswer>;
  // A GitHub connect's callback or a verified delivery (plan-room/github/github-room.ts): the plan checks its own
  // connection before it acts.
  github(call: GithubRoomCall): Promise<GithubRoomAnswer>;
};

export function planRoom(env: Pick<Env, 'PLAN_ROOM'>, planId: string): PlanRoomClient {
  const ns = env.PLAN_ROOM;
  const stub = ns.get(ns.idFromName(planId));
  // The stub's RPC types wrap every answer for the wire; the shapes here are the class's own.
  const room = stub as unknown as PlanRoomRpc;
  return {
    outline: () => room.outline(planId),
    route: (request, identity) => room.route(planId, request, identity),
    exportImage: (query) => room.exportImage(planId, query),
    exportFile: (query) => room.exportFile(planId, query),
    importFile: (file) => room.importFile(planId, file),
    exportTables: () => room.exportTables(planId),
    exportComments: () => room.exportComments(planId),
    hasTab: (tabId) => room.hasTab(planId, tabId),
    addConnectedTab: (write) => room.addConnectedTab(planId, write),
    item: (itemId) => room.item(planId, itemId),
    grantImage: (imageId) => room.grantImage(planId, imageId),
    servesImage: (imageId, tabScope) => room.servesImage(planId, imageId, tabScope),
    grantedImages: (imageIds) => room.grantedImages(planId, imageIds),
    exportCopy: (onlyTabId, copier) => room.exportCopy(planId, onlyTabId, copier),
    importCopy: (copy) => room.importCopy(planId, copy),
    importMigrated: (payload) => room.importMigrated(planId, payload),
    purge: () => room.purge(planId),
    revokeCodes: (codes, reason) => room.revokeCodes(planId, codes, reason),
    community: () => room.community(planId),
    communityPostTitle: (code) => room.communityPostTitle(planId, code),
    communityListing: (code) => room.communityListing(planId, code),
    joined: (personId) => room.joined(planId, personId),
    anonymise: (personId) => room.anonymise(planId, personId),
    sharedTabCopy: (tabId) => room.sharedTabCopy(planId, tabId),
    shareJoined: (tabId, member, seen) => room.shareJoined(planId, tabId, member, seen),
    receiveShares: (from, messages) => room.receiveShares(planId, from, messages),
    threadsFor: (ids, via) => room.threadsFor(planId, ids, via),
    threadWrite: (threadId, op, via) => room.threadWrite(planId, threadId, op, via),
    threadsRelayed: (relay) => room.threadsRelayed(planId, relay),
    incomingHook: (ruleId, call) => room.incomingHook(planId, ruleId, call),
    github: (call) => room.github(planId, call),
  };
}

// The PlanRoom RPC surface, by the plan id each call names (the room checks it is its own).
export type PlanRoomRpc = {
  outline(planId: string): Promise<PlanOutline>;
  route(planId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  exportImage(planId: string, query: ExportQuery): Promise<ExportResult>;
  exportFile(planId: string, query: ExportQuery): Promise<ExportResult>;
  importFile(planId: string, file: ProjectFileImport): Promise<void>;
  exportTables(planId: string): Promise<ExportTablesResult>;
  exportComments(planId: string): Promise<ExportCommentsResult>;
  hasTab(planId: string, tabId: string): Promise<boolean>;
  addConnectedTab(planId: string, write: ConnectedTabWrite): Promise<ConnectedTabOutcome>;
  item(planId: string, itemId: string): Promise<Item | null>;
  grantImage(planId: string, imageId: string): Promise<void>;
  servesImage(planId: string, imageId: string, tabScope: string | null): Promise<boolean>;
  grantedImages(planId: string, imageIds: readonly string[]): Promise<string[]>;
  exportCopy(
    planId: string,
    onlyTabId: string | null,
    copier: Copier | null,
  ): Promise<CopySource | null>;
  importCopy(planId: string, copy: PlanCopy): Promise<void>;
  importMigrated(planId: string, payload: MigrationRoomPayload): Promise<MigrationDoorAnswer>;
  purge(planId: string): Promise<void>;
  revokeCodes(planId: string, codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  community(planId: string): Promise<CommunityLink | null>;
  communityPostTitle(planId: string, code: string): Promise<string | null>;
  communityListing(planId: string, code: string): Promise<CommunityListing | null>;
  joined(planId: string, personId: string): Promise<void>;
  anonymise(planId: string, personId: string): Promise<number>;
  sharedTabCopy(planId: string, tabId: string): Promise<SharedTabCopy | null>;
  shareJoined(
    planId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean>;
  receiveShares(planId: string, from: string, messages: ShareMessage[]): Promise<ShareAnswer[]>;
  threadsFor(planId: string, ids: string[], via: string): Promise<CardThread[]>;
  threadWrite(
    planId: string,
    threadId: string,
    op: ThreadOp,
    via: string,
  ): Promise<ThreadWriteResult>;
  threadsRelayed(planId: string, relay: ThreadsRelay): Promise<string[]>;
  incomingHook(planId: string, ruleId: string, call: HookCall): Promise<HookAnswer>;
  github(planId: string, call: GithubRoomCall): Promise<GithubRoomAnswer>;
  fetch(request: Request): Promise<Response>;
};
