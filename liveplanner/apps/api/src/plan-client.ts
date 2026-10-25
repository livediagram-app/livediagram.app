// The worker's way into a plan's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per plan,
// its RPC methods with the plan id filled in. Every content read and write goes through here.
//
// Inside the plan's own Durable Object the same call is a plain method call on the room itself (plan-room.ts
// `localNamespace`), so code shared by the worker and the room (getProject's outline, the room relays) costs no
// hop there.

import type { Item } from '@liveplanner/items';
import type { PlanCopy, PlanOutline } from './plan-room/plan-content';
import type { RouteIdentity } from './plan-room/plan-route';
import type {
  ExportQuery,
  ExportResult,
  ShareAnswer,
  ShareMessage,
  SharedTabCopy,
} from '@liveworkspace/index-app';
import type { Env } from './types';

export type PlanRoomClient = {
  // The tabs (no bodies) and type catalogue a project read carries.
  outline(): Promise<PlanOutline>;
  // One API request about this plan, answered inside its Durable Object by the same handlers as before
  // (plan-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The plan drawn for liveworkspace's previews (the export door, plan-room.ts `exportImage`), where the content is.
  exportImage(query: ExportQuery): Promise<ExportResult>;
  // Whether the plan holds this tab (a workbench ticket's check).
  hasTab(tabId: string): Promise<boolean>;
  // One card, by id (a mention email reads the comment from the card itself).
  item(itemId: string): Promise<Item | null>;
  // A copy's two halves (plan-content.ts).
  exportCopy(onlyTabId: string | null, redactAuthorsFor: string | null): Promise<PlanCopy | null>;
  importCopy(copy: PlanCopy): Promise<void>;
  // The plan is gone for good: end every session and drop everything it stored.
  purge(): Promise<void>;
  // Share links revoked elsewhere (the index): their sessions end now.
  revokeCodes(codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
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
    hasTab: (tabId) => room.hasTab(planId, tabId),
    item: (itemId) => room.item(planId, itemId),
    exportCopy: (onlyTabId, redact) => room.exportCopy(planId, onlyTabId, redact),
    importCopy: (copy) => room.importCopy(planId, copy),
    purge: () => room.purge(planId),
    revokeCodes: (codes, reason) => room.revokeCodes(planId, codes, reason),
    joined: (personId) => room.joined(planId, personId),
    anonymise: (personId) => room.anonymise(planId, personId),
    sharedTabCopy: (tabId) => room.sharedTabCopy(planId, tabId),
    shareJoined: (tabId, member, seen) => room.shareJoined(planId, tabId, member, seen),
    receiveShares: (from, messages) => room.receiveShares(planId, from, messages),
  };
}

// The PlanRoom RPC surface, by the plan id each call names (the room checks it is its own).
export type PlanRoomRpc = {
  outline(planId: string): Promise<PlanOutline>;
  route(planId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  exportImage(planId: string, query: ExportQuery): Promise<ExportResult>;
  hasTab(planId: string, tabId: string): Promise<boolean>;
  item(planId: string, itemId: string): Promise<Item | null>;
  exportCopy(
    planId: string,
    onlyTabId: string | null,
    redact: string | null,
  ): Promise<PlanCopy | null>;
  importCopy(planId: string, copy: PlanCopy): Promise<void>;
  purge(planId: string): Promise<void>;
  revokeCodes(planId: string, codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
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
  fetch(request: Request): Promise<Response>;
};
