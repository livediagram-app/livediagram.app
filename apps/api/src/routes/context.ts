// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import { canEditDiagram, canReadDiagram } from '../auth/diagram-access';
import { getDiagram, getMembership } from '../db';
import { forbidden, missingAuth, notFound } from '../responses';
import type { DiagramDTO, Env } from '../types';

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
  // token reaches the same diagrams the app does (docs/specs/015-api/public-api-and-tokens.md §3.4). Account
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
  // Schedule background work that may outlive the response (docs/specs/014-identity/transactional-email.md email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// Visitor share code carried on edit/view-link requests so a non-owner
// can authorise against a diagram they don't own.
//
// Exported because its PRESENCE is the only honest signal that a caller
// arrived through a share link. "Isn't the owner" is not that signal: a
// joined team member reads every diagram in their team's library without a
// code (docs/specs/013-workspace/team-shared-diagrams.md), so the visitor-facing timeline events keyed on
// `owner !== ownerId` were reporting teammates as strangers with a link.
export function shareCodeOf(request: Request): string | null {
  return request.headers.get('X-Share-Code');
}

// Share password (docs/specs/013-workspace/share-password.md) carried alongside the share code when the
// diagram the visitor is accessing is password-protected. Owners never
// send it (their identity short-circuits the check); a non-owner with a
// share code must, or the access gate denies password-protected diagrams.
export function sharePasswordOf(request: Request): string | null {
  return request.headers.get('X-Share-Password');
}

// Route-side wrappers around canReadDiagram / canEditDiagram. Most
// handler call sites need the same six args to the auth helpers
// (env, diagramId, caller, share code, diagram owner, share
// password); four of them (env, caller, share code, share password)
// fall straight out of the RouteContext, so condensing them into a
// (ctx, diagramId, diagramOwnerId) helper drops a stack of
// repetitive 6-line invocations to 1-liners. Behaviour stays
// identical: each helper just forwards the ctx-derived args.
export function gateRead(
  ctx: RouteContext,
  diagramId: string,
  diagramOwnerId: string,
  diagramTeamId: string | null = null,
): Promise<boolean> {
  return canReadDiagram(
    ctx.env,
    diagramId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    diagramOwnerId,
    sharePasswordOf(ctx.request),
    diagramTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-diagrams.md access trust boundary).
    ctx.verifiedUserId,
  );
}

export function gateEdit(
  ctx: RouteContext,
  diagramId: string,
  diagramOwnerId: string,
  diagramTeamId: string | null = null,
): Promise<boolean> {
  return canEditDiagram(
    ctx.env,
    diagramId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    diagramOwnerId,
    sharePasswordOf(ctx.request),
    diagramTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-diagrams.md access trust boundary).
    ctx.verifiedUserId,
  );
}

// Route-entry guards. Each resolves the caller / loads + authorises the
// diagram and returns EITHER the value the handler needs OR the exact
// Response it should return instead. The caller's one-liner is:
//
//   const owner = requireOwner(ctx);
//   if (owner instanceof Response) return owner;
//
// which collapses the `const owner = resolveOwner(); if (!owner) return
// missingAuth();` pair (and its load-and-check cousins) that every
// owner-scoped path in diagrams.ts repeated by hand. Centralising them
// means the authz status-code mapping (400 / 404 / 403) lives in one
// place a reviewer can check, instead of N copies that can drift.

// The resolved owner id, or the 400 to return when neither a Clerk
// token nor X-Owner-Id identifies the caller.
export function requireOwner(ctx: RouteContext): string | Response {
  return ctx.resolveOwner() ?? missingAuth();
}

// Is `ctx` the owner of this diagram? The one rule both owner-only guards
// below share, and the reason it isn't a bare `owner === ownerId`.
//
// For a PERSONAL diagram the hybrid identity is safe: the owner id is either
// a Clerk `sub` the caller proved with a verified JWT, or a guest UUID that
// is unguessable.
//
// For a TEAM diagram it is NOT. A team's owner id is a Clerk id deliberately
// visible to every teammate (`GET /api/teams/<id>` lists `members[].userId`),
// so accepting the unsigned `X-Owner-Id` header here would let anyone who
// ever learned it — a removed member, an invitee who declined — present it as
// a credential and reach the owner-only surfaces: reading the share password
// in the clear, minting an edit-role share link, clearing the password,
// deleting the diagram. So a team diagram's ownership must be proven with a
// server-VERIFIED account id (Clerk session or API token), never the header.
//
// This is the same trust boundary auth/diagram-access.ts draws for the
// read/edit gates; it belongs here too rather than only there.
//
// And the owner of a team diagram must still BE in the team. A member who
// leaves or is removed has their team work handed on (handTeamWorkToHeir),
// but rows from before that existed are still owned by people who have gone,
// and ownership is what the share-link, password, delete and move-out routes
// check first.
export async function ownsDiagram(
  ctx: RouteContext,
  diagram: Pick<DiagramDTO, 'ownerId' | 'teamId'>,
): Promise<boolean> {
  if (diagram.teamId) {
    if (ctx.verifiedUserId == null || ctx.verifiedUserId !== diagram.ownerId) return false;
    const membership = await getMembership(ctx.env, diagram.teamId, ctx.verifiedUserId);
    return membership?.status === 'joined';
  }
  return ctx.resolveOwner() === diagram.ownerId;
}

// Owner-only resource: resolve the caller, load the diagram, and confirm
// the caller owns it. Returns the diagram, or 400 (no owner) / 404
// (missing) / 403 (foreign). 404-before-403 means a foreign id can't be
// distinguished from a missing one until ownership is proven, but once
// the row exists a non-owner gets 403 — matching every owner-only branch
// diagrams.ts hand-rolled (DELETE :id, /folder, /share, /share-password,
// /share/:code, /log/tab).
export async function requireOwnedDiagram(
  ctx: RouteContext,
  diagramId: string,
): Promise<DiagramDTO | Response> {
  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();
  const existing = await getDiagram(ctx.env, diagramId);
  if (!existing) return notFound();
  if (!(await ownsDiagram(ctx, existing))) return forbidden();
  return existing;
}

// Share-gated resource: resolve the caller, load the diagram, and run
// the read- or edit-access gate (owner OR a valid share code of the
// matching role). Returns the diagram, or 400 / 404 / 403. Used by the
// tab-content + change-log paths where a non-owner share visitor is a
// legitimate caller.
export async function requireDiagramAccess(
  ctx: RouteContext,
  diagramId: string,
  mode: 'read' | 'edit',
): Promise<DiagramDTO | Response> {
  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();
  const existing = await getDiagram(ctx.env, diagramId);
  if (!existing) return notFound();
  const allowed = await (mode === 'edit' ? gateEdit : gateRead)(
    ctx,
    diagramId,
    existing.ownerId,
    existing.teamId,
  );
  if (!allowed) return forbidden();
  return existing;
}
