// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import {
  canEditDocument,
  canReadDocument,
  resolveDocumentGrant,
  type DocumentGrant,
} from '../auth/document-access';
import { getDocument, getMembership, getShareLink, getTrashedDocumentMeta } from '../db';
import { documentTrashed, forbidden, missingAuth, notFound } from '../responses';
import type { DocumentDTO, Env } from '../types';

export type RouteContext = {
  request: Request;
  env: Env;
  url: URL;
  // Path split on '/', leading slash stripped: `['api', '<resource>', ...]`.
  segments: string[];
  // The verified Clerk userId, or null. Routes that must be
  // Clerk-only (account deletion, guest->authed migration, teams)
  // read this directly rather than through `resolveOwner` so there's
  // no X-Owner-Id fallback.
  clerkUserId: string | null;
  // The server-verified Clerk account id from EITHER credential: a Clerk
  // session JWT, or an `lvd_` API token (whose owner is always a Clerk
  // account, docs/specs/015-api/public-api-and-tokens.md §3.3). This is the identity for team-membership
  // CONTENT access — gateRead/gateEdit and the teams-surface reads — so a
  // token reaches the same documents the app does (docs/specs/015-api/public-api-and-tokens.md §3.4). Account
  // and team ADMINISTRATION (team mutations, token management, account
  // deletion, migration) keeps requiring `clerkUserId`: a leaked token
  // must not be able to manage membership or mint further credentials.
  verifiedUserId: string | null;
  // The verified `email` claim from the Clerk JWT (docs/specs/013-workspace/teams.md), or null
  // when Clerk is off, the caller is a guest, or the deployment's JWT
  // template doesn't carry the claim. Never read from a header — it
  // drives teams' invite auto-connection so it must be unforgeable.
  clerkEmail: string | null;
  // Hybrid identity (docs/specs/014-identity/auth-and-guest-access.md): the verified Clerk userId, else the
  // legacy X-Owner-Id header, else null. Resolved once in `fetch`.
  resolveOwner: () => string | null;
  // The API token the request presented, or null for a Clerk session or a guest. Only a token
  // makes a changeset an agent's, and a token may never do a whole-tab save
  // (docs/specs/024-agents/agent-changesets.md). Optional so unit tests can leave it out.
  token?: { id: string; readOnly?: boolean } | null;
  // Schedule background work that may outlive the response (docs/specs/014-identity/transactional-email.md email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// Visitor share code carried on edit/view-link requests so a non-owner
// can authorise against a document they don't own.
//
// Exported because its PRESENCE is the only honest signal that a caller
// arrived through a share link. "Isn't the owner" is not that signal: a
// joined team member reads every document in their team's library without a
// code (docs/specs/013-workspace/team-shared-documents.md), so the visitor-facing timeline events keyed on
// `owner !== ownerId` were reporting teammates as strangers with a link.
export function shareCodeOf(request: Request): string | null {
  return request.headers.get('X-Share-Code');
}

// Share password (docs/specs/013-workspace/share-password.md) carried alongside the share code when the
// document the visitor is accessing is password-protected. Owners never
// send it (their identity short-circuits the check); a non-owner with a
// share code must, or the access gate denies password-protected documents.
export function sharePasswordOf(request: Request): string | null {
  return request.headers.get('X-Share-Password');
}

// Route-side wrappers around canReadDocument / canEditDocument. Most
// handler call sites need the same six args to the auth helpers
// (env, documentId, caller, share code, document owner, share
// password); four of them (env, caller, share code, share password)
// fall straight out of the RouteContext, so condensing them into a
// (ctx, documentId, documentOwnerId) helper drops a stack of
// repetitive 6-line invocations to 1-liners. Behaviour stays
// identical: each helper just forwards the ctx-derived args.
//
// `tabId` names the tab the request touches. Leave it off for a
// document-level door: a tab-scoped link is then refused (fail closed,
// docs/specs/013-workspace/tab-scoped-share-links.md).
//
// A Community post's link is refused too unless the door passes `COMMUNITY_CONTENT`
// (docs/specs/025-community/community.md "Viewing a post's document"): the link is a content-only pass,
// so the document, its tabs, images and copy serve it, and comments, history, the timeline and any door
// added later do not. Fail closed, like the tab scope.
export const COMMUNITY_CONTENT = { community: true } as const;
export type GateOptions = { community?: boolean };

export function gateRead(
  ctx: RouteContext,
  documentId: string,
  documentOwnerId: string,
  documentTeamId: string | null = null,
  tabId?: string,
  opts: GateOptions = {},
): Promise<boolean> {
  return canReadDocument(
    ctx.env,
    documentId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    documentOwnerId,
    sharePasswordOf(ctx.request),
    documentTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-documents.md access trust boundary).
    ctx.verifiedUserId,
    tabId,
    opts.community ?? false,
  );
}

// The participation gate (docs/specs/024-agents/agent-presence.md "Token levels"): comments, session answers and
// agent presence. Until share roles are built it names today's rule, read access to the document or tab; a
// read-only token is refused every write at the choke point. It becomes the Participant check when share roles land.
export function gateParticipate(
  ctx: RouteContext,
  documentId: string,
  documentOwnerId: string,
  documentTeamId: string | null = null,
  tabId?: string,
): Promise<boolean> {
  return gateRead(ctx, documentId, documentOwnerId, documentTeamId, tabId);
}

export function gateEdit(
  ctx: RouteContext,
  documentId: string,
  documentOwnerId: string,
  documentTeamId: string | null = null,
  tabId?: string,
): Promise<boolean> {
  return canEditDocument(
    ctx.env,
    documentId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    documentOwnerId,
    sharePasswordOf(ctx.request),
    documentTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-documents.md access trust boundary).
    ctx.verifiedUserId,
    tabId,
  );
}

// The caller's grant on a document, scope included, for the doors that narrow
// what they return to a scoped visitor's tab rather than refuse them
// (docs/specs/013-workspace/tab-scoped-share-links.md). Null = no access.
//
// A Community post's link answers null unless the door passes `COMMUNITY_CONTENT` (see gateRead).
export async function gateGrant(
  ctx: RouteContext,
  documentId: string,
  documentOwnerId: string,
  documentTeamId: string | null = null,
  opts: GateOptions = {},
): Promise<DocumentGrant | null> {
  const grant = await resolveDocumentGrant(
    ctx.env,
    documentId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    documentOwnerId,
    sharePasswordOf(ctx.request),
    documentTeamId,
    ctx.verifiedUserId,
  );
  return grant?.community && !opts.community ? null : grant;
}

// Route-entry guards. Each resolves the caller / loads + authorises the
// document and returns EITHER the value the handler needs OR the exact
// Response it should return instead. The caller's one-liner is:
//
//   const owner = requireOwner(ctx);
//   if (owner instanceof Response) return owner;
//
// which collapses the `const owner = resolveOwner(); if (!owner) return
// missingAuth();` pair (and its load-and-check cousins) that every
// owner-scoped path in documents.ts repeated by hand. Centralising them
// means the authz status-code mapping (400 / 404 / 403) lives in one
// place a reviewer can check, instead of N copies that can drift.

// The resolved owner id, or the 400 to return when neither a Clerk
// token nor X-Owner-Id identifies the caller.
export function requireOwner(ctx: RouteContext): string | Response {
  return ctx.resolveOwner() ?? missingAuth();
}

// Is `ctx` the owner of this document? The one rule both owner-only guards
// below share, and the reason it isn't a bare `owner === ownerId`.
//
// For a PERSONAL document the hybrid identity is safe: the owner id is either
// a Clerk `sub` the caller proved with a verified JWT, or a guest UUID that
// is unguessable.
//
// For a TEAM document it is NOT. A team's owner id is a Clerk id deliberately
// visible to every teammate (`GET /api/teams/<id>` lists `members[].userId`),
// so accepting the unsigned `X-Owner-Id` header here would let anyone who
// ever learned it — a removed member, an invitee who declined — present it as
// a credential and reach the owner-only surfaces: reading the share password
// in the clear, minting an edit-role share link, clearing the password,
// deleting the document. So a team document's ownership must be proven with a
// server-VERIFIED account id (Clerk session or API token), never the header.
//
// This is the same trust boundary auth/document-access.ts draws for the
// read/edit gates; it belongs here too rather than only there.
//
// And the owner of a team document must still BE in the team. A member who
// leaves or is removed has their team work handed on (handTeamWorkToHeir),
// but rows from before that existed are still owned by people who have gone,
// and ownership is what the share-link, password, delete and move-out routes
// check first.
export async function ownsDocument(
  ctx: RouteContext,
  liveDoc: Pick<DocumentDTO, 'ownerId' | 'teamId'>,
): Promise<boolean> {
  if (liveDoc.teamId) {
    if (ctx.verifiedUserId == null || ctx.verifiedUserId !== liveDoc.ownerId) return false;
    const membership = await getMembership(ctx.env, liveDoc.teamId, ctx.verifiedUserId);
    return membership?.status === 'joined';
  }
  return ctx.resolveOwner() === liveDoc.ownerId;
}

// May `ctx` delete this document? Its owner, OR a joined member of its team
// (docs/specs/013-workspace/team-shared-documents.md: members fully manage team
// documents, delete included). NOT a share-link visitor: editing content via a
// link is one thing, destroying the document is owner/team-only. Also gates
// what the delete confirmation reads first (the shared-tabs notice).
export async function mayDeleteDocument(
  ctx: RouteContext,
  liveDoc: Pick<DocumentDTO, 'ownerId' | 'teamId'>,
): Promise<boolean> {
  if (await ownsDocument(ctx, liveDoc)) return true;
  if (!liveDoc.teamId || !ctx.verifiedUserId) return false;
  const membership = await getMembership(ctx.env, liveDoc.teamId, ctx.verifiedUserId);
  return membership?.status === 'joined';
}

// The answer for a document id no LIVE row holds (docs/specs/013-workspace/trash.md):
// 410 `document_trashed` when it is in the Trash and the caller could have
// opened it (owner, joined team member, share-code holder), else the 404 a
// never-existing id gets, so the deleted state leaks nothing to a stranger.
export async function missingDocument(ctx: RouteContext, documentId: string): Promise<Response> {
  const trashed = await getTrashedDocumentMeta(ctx.env, documentId);
  if (!trashed) return notFound();
  const grant = await gateGrant(
    ctx,
    documentId,
    trashed.ownerId,
    trashed.teamId,
    COMMUNITY_CONTENT,
  );
  return grant ? documentTrashed() : notFound();
}

// Owner-only resource: resolve the caller, load the document, and confirm
// the caller owns it. Returns the document, or 400 (no owner) / 404
// (missing) / 403 (foreign). 404-before-403 means a foreign id can't be
// distinguished from a missing one until ownership is proven, but once
// the row exists a non-owner gets 403 — matching every owner-only branch
// documents.ts hand-rolled (DELETE :id, /folder, /share, /share-password,
// /share/:code).
export async function requireOwnedDocument(
  ctx: RouteContext,
  documentId: string,
): Promise<DocumentDTO | Response> {
  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();
  const existing = await getDocument(ctx.env, documentId);
  if (!existing) return missingDocument(ctx, documentId);
  if (!(await ownsDocument(ctx, existing))) return forbidden();
  return existing;
}

// A refused request on a tab: 404 when the caller's grant is confined to another tab, 403 otherwise.
export async function deniedOnTab(
  ctx: RouteContext,
  liveDoc: { id: string; ownerId: string; teamId: string | null },
): Promise<Response> {
  const grant = await gateGrant(ctx, liveDoc.id, liveDoc.ownerId, liveDoc.teamId);
  return grant ? notFound() : forbidden();
}

// Does the caller come in through a Community post's link (docs/specs/025-community/community.md "Viewing a post's
// document")? Such a visitor reads the board but not its comments. Called only on a non-owner read, so an owner
// presenting a code still sees everything.
export async function viaCommunityLink(ctx: RouteContext): Promise<boolean> {
  const code = shareCodeOf(ctx.request);
  if (!code) return false;
  return (await getShareLink(ctx.env, code))?.purpose === 'community';
}
