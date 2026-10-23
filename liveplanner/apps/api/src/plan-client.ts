// The worker's way into a plan's Durable Object (docs/specs/015-api/api.md "Storage"): one typed stub per plan,
// its RPC methods with the plan id filled in. Every content read and write goes through here; D1 holds none.
//
// Inside the plan's own Durable Object the same call is a plain method call on the room itself (plan-room.ts
// `localNamespace`), so code shared by the worker and the room (getProject's outline, the room relays) costs no
// hop there.

import type { Item } from '@liveplanner/items';
import type { PlanCopy, PlanOutline } from './plan-room/plan-content';
import type { RouteIdentity } from './plan-room/plan-route';
import type { ThumbnailSubject } from './thumbnail';
import type { Env } from './types';

export type PlanRoomClient = {
  // The tabs (no bodies) and type catalogue a project read carries.
  outline(): Promise<PlanOutline>;
  // One API request about this plan, answered inside its Durable Object by the same handlers as before
  // (plan-route.ts), with the caller's identity as the worker resolved it.
  route(request: Request, identity: RouteIdentity): Promise<Response>;
  // The snapshot image a reader gets (thumbnail.ts), drawn where the content is.
  image(subject: ThumbnailSubject, tabId: string | null): Promise<string | null>;
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
};

export function planRoom(env: Pick<Env, 'PLAN_ROOM'>, planId: string): PlanRoomClient {
  const ns = env.PLAN_ROOM;
  const stub = ns.get(ns.idFromName(planId));
  // The stub's RPC types wrap every answer for the wire; the shapes here are the class's own.
  const room = stub as unknown as PlanRoomRpc;
  return {
    outline: () => room.outline(planId),
    route: (request, identity) => room.route(planId, request, identity),
    image: (subject, tabId) => room.image(planId, subject, tabId),
    hasTab: (tabId) => room.hasTab(planId, tabId),
    item: (itemId) => room.item(planId, itemId),
    exportCopy: (onlyTabId, redact) => room.exportCopy(planId, onlyTabId, redact),
    importCopy: (copy) => room.importCopy(planId, copy),
    purge: () => room.purge(planId),
    revokeCodes: (codes, reason) => room.revokeCodes(planId, codes, reason),
    joined: (personId) => room.joined(planId, personId),
  };
}

// The PlanRoom RPC surface, by the plan id each call names (the room checks it is its own).
export type PlanRoomRpc = {
  outline(planId: string): Promise<PlanOutline>;
  route(planId: string, request: Request, identity: RouteIdentity): Promise<Response>;
  image(planId: string, subject: ThumbnailSubject, tabId: string | null): Promise<string | null>;
  hasTab(planId: string, tabId: string): Promise<boolean>;
  item(planId: string, itemId: string): Promise<Item | null>;
  exportCopy(planId: string, onlyTabId: string | null, redact: string | null): Promise<PlanCopy | null>;
  importCopy(planId: string, copy: PlanCopy): Promise<void>;
  purge(planId: string): Promise<void>;
  revokeCodes(planId: string, codes: string[], reason?: 'revoked' | 'rescoped'): Promise<number>;
  joined(planId: string, personId: string): Promise<void>;
  fetch(request: Request): Promise<Response>;
};
