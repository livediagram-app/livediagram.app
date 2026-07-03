// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import { canEditDiagram, canReadDiagram } from '../auth/diagram-access';
import { getDiagram } from '../db';
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
  // account, spec/61 §3.3). This is the identity for team-membership
  // CONTENT access — gateRead/gateEdit and the teams-surface reads — so a
  // token reaches the same diagrams the app does (spec/61 §3.4). Account
  // and team ADMINISTRATION (team mutations, token management, account
  // deletion, migration) keeps requiring `clerkUserId`: a leaked token
  // must not be able to manage membership or mint further credentials.
  verifiedUserId: string | null;
  // The verified `email` claim from the Clerk JWT (spec/32), or null
  // when Clerk is off, the caller is a guest, or the deployment's JWT
  // template doesn't carry the claim. Never read from a header — it
  // drives teams' invite auto-connection so it must be unforgeable.
  clerkEmail: string | null;
  // Hybrid identity (spec/04): the verified Clerk userId, else the
  // legacy X-Owner-Id header, else null. Resolved once in `fetch`.
  resolveOwner: () => string | null;
  // Schedule background work that may outlive the response (spec/64 email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// Visitor share code carried on edit/view-link requests so a non-owner
// can authorise against a diagram they don't own.
function shareCodeOf(request: Request): string | null {
  return request.headers.get('X-Share-Code');
}

// Share password (spec/24) carried alongside the share code when the
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
    // (spec/35 access trust boundary).
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
    // (spec/35 access trust boundary).
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
  if (existing.ownerId !== owner) return forbidden();
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
