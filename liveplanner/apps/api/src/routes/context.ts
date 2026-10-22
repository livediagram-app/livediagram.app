import { objectOrEmpty, type WorkbenchRole } from '@liveplanner/api-schema';
// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import {
  canEditProject,
  canParticipateProject,
  canReadProject,
  resolveProjectGrant,
  type ProjectGrant,
} from '../auth/project-access';
import type { SharePasswordAttempt } from '../auth/share-access';
import type { WorkbenchReach } from '../db/workbench';
import { clientRateKey } from '../client-ip';
import { getProject, getMembership, getTrashedProjectMeta } from '../db';
import { badRequest, projectTrashed, forbidden, missingAuth, notFound } from '../responses';
import type { ProjectDTO, Env } from '../types';

// A workbench session as the choke point resolved it (blueprint "A request bearing lvw_", "The choke point by
// scope"): one project in the project scope, the workspace (from an optional folder) in the workspace scope.
export type WorkbenchContext = {
  sessionId: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  level: WorkbenchRole;
  expiresAt: number;
} & WorkbenchReach;

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
  // token reaches the same projects the app does (docs/specs/015-api/public-api-and-tokens.md §3.4). Account
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
  // The presenting workbench session (docs/specs/013-workspace/workbench-embeds.md), or null for every other
  // caller. Under one, `clerkUserId` and `token` are null and `resolveOwner()` is the owner: a person's editor on
  // one project, never a token and never an administrator. Optional so unit tests can leave it out.
  workbench?: WorkbenchContext | null;
  // Schedule background work that may outlive the response (docs/specs/014-identity/transactional-email.md email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// Visitor share code carried on edit/view-link requests so a non-owner
// can authorise against a project they don't own.
//
// Exported because its PRESENCE is the only honest signal that a caller
// arrived through a share link. "Isn't the owner" is not that signal: a
// joined team member reads every project in their team's library without a
// code (docs/specs/013-workspace/team-shared-projects.md), so the visitor-facing timeline events keyed on
// `owner !== ownerId` were reporting teammates as strangers with a link.
export function shareCodeOf(request: Request): string | null {
  return request.headers.get('X-Share-Code');
}

// Share password (docs/specs/013-workspace/share-password.md) carried alongside the share code when the
// project the visitor is accessing is password-protected. Owners never
// send it (their identity short-circuits the check); a non-owner with a
// share code must, or the access gate denies password-protected projects.
export function sharePasswordOf(request: Request): SharePasswordAttempt | null {
  const value = request.headers.get('X-Share-Password');
  return value === null ? null : { value, rateKey: clientRateKey(request) };
}

// Route-side wrappers around canReadProject / canEditProject. Most
// handler call sites need the same six args to the auth helpers
// (env, projectId, caller, share code, project owner, share
// password); four of them (env, caller, share code, share password)
// fall straight out of the RouteContext, so condensing them into a
// (ctx, projectId, projectOwnerId) helper drops a stack of
// repetitive 6-line invocations to 1-liners. Behaviour stays
// identical: each helper just forwards the ctx-derived args.
//
// `tabId` names the tab the request touches. Leave it off for a
// project-level door: a tab-scoped link is then refused (fail closed,
// docs/specs/013-workspace/tab-scoped-share-links.md).

export function gateRead(
  ctx: RouteContext,
  projectId: string,
  projectOwnerId: string,
  projectTeamId: string | null = null,
  tabId?: string,
): Promise<boolean> {
  return canReadProject(
    ctx.env,
    projectId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    projectOwnerId,
    sharePasswordOf(ctx.request),
    projectTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-projects.md access trust boundary).
    ctx.verifiedUserId,
    tabId,
  );
}

// The Participant gate (docs/specs/013-workspace/share-roles.md): every write a Participant may make beside an
// Editor (comments, Q&A notes and upvotes, Plan cards, Sheet cells). A Viewer only looks, so it is refused. Agent
// presence stays on gateRead: an agent acts at its owner's level.
export function gateParticipate(
  ctx: RouteContext,
  projectId: string,
  projectOwnerId: string,
  projectTeamId: string | null = null,
  tabId?: string,
): Promise<boolean> {
  return canParticipateProject(
    ctx.env,
    projectId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    projectOwnerId,
    sharePasswordOf(ctx.request),
    projectTeamId,
    ctx.verifiedUserId,
    tabId,
  );
}

export function gateEdit(
  ctx: RouteContext,
  projectId: string,
  projectOwnerId: string,
  projectTeamId: string | null = null,
  tabId?: string,
): Promise<boolean> {
  return canEditProject(
    ctx.env,
    projectId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    projectOwnerId,
    sharePasswordOf(ctx.request),
    projectTeamId,
    // Server-verified account id (Clerk session or API token) for the
    // team-membership check — never the unsigned X-Owner-Id header
    // (docs/specs/013-workspace/team-shared-projects.md access trust boundary).
    ctx.verifiedUserId,
    tabId,
  );
}

// The caller's grant on a project, scope included, for the doors that narrow
// what they return to a scoped visitor's tab rather than refuse them
// (docs/specs/013-workspace/tab-scoped-share-links.md). Null = no access.
export function gateGrant(
  ctx: RouteContext,
  projectId: string,
  projectOwnerId: string,
  projectTeamId: string | null = null,
): Promise<ProjectGrant | null> {
  return resolveProjectGrant(
    ctx.env,
    projectId,
    ctx.resolveOwner(),
    shareCodeOf(ctx.request),
    projectOwnerId,
    sharePasswordOf(ctx.request),
    projectTeamId,
    ctx.verifiedUserId,
  );
}

// Route-entry guards. Each resolves the caller / loads + authorises the
// project and returns EITHER the value the handler needs OR the exact
// Response it should return instead. The caller's one-liner is:
//
//   const owner = requireOwner(ctx);
//   if (owner instanceof Response) return owner;
//
// which collapses the `const owner = resolveOwner(); if (!owner) return
// missingAuth();` pair (and its load-and-check cousins) that every
// owner-scoped path in projects.ts repeated by hand. Centralising them
// means the authz status-code mapping (400 / 404 / 403) lives in one
// place a reviewer can check, instead of N copies that can drift.

// The resolved owner id, or the 400 to return when neither a Clerk
// token nor X-Owner-Id identifies the caller.
export function requireOwner(ctx: RouteContext): string | Response {
  return ctx.resolveOwner() ?? missingAuth();
}

// Is `ctx` the owner of this project? The one rule both owner-only guards
// below share, and the reason it isn't a bare `owner === ownerId`.
//
// For a PERSONAL project the hybrid identity is safe: the owner id is either
// a Clerk `sub` the caller proved with a verified JWT, or a guest UUID that
// is unguessable.
//
// For a TEAM project it is NOT. A team's owner id is a Clerk id deliberately
// visible to every teammate (`GET /api/teams/<id>` lists `members[].userId`),
// so accepting the unsigned `X-Owner-Id` header here would let anyone who
// ever learned it — a removed member, an invitee who declined — present it as
// a credential and reach the owner-only surfaces: reading the share password
// in the clear, minting an edit-role share link, clearing the password,
// deleting the project. So a team project's ownership must be proven with a
// server-VERIFIED account id (Clerk session or API token), never the header.
//
// This is the same trust boundary auth/project-access.ts draws for the
// read/edit gates; it belongs here too rather than only there.
//
// And the owner of a team project must still BE in the team. A member who
// leaves or is removed has their team work handed on (handTeamWorkToHeir),
// but rows from before that existed are still owned by people who have gone,
// and ownership is what the share-link, password, delete and move-out routes
// check first.
export async function ownsProject(
  ctx: RouteContext,
  liveDoc: Pick<ProjectDTO, 'ownerId' | 'teamId'>,
): Promise<boolean> {
  if (liveDoc.teamId) {
    if (ctx.verifiedUserId == null || ctx.verifiedUserId !== liveDoc.ownerId) return false;
    const membership = await getMembership(ctx.env, liveDoc.teamId, ctx.verifiedUserId);
    return membership?.status === 'joined';
  }
  return ctx.resolveOwner() === liveDoc.ownerId;
}

// Does `ctx` manage this project? Its owner, OR a joined member of its team
// (docs/specs/013-workspace/team-shared-projects.md: a team's library belongs to
// every joined member, so each may share, delete and restore its projects). NOT a
// share-link visitor: editing content via a link is one thing, deciding who else
// gets in or destroying the project is owner/team-only. The member leg is checked
// against the verified account id, never the header, like ownsProject.
async function managesProject(
  ctx: RouteContext,
  liveDoc: Pick<ProjectDTO, 'ownerId' | 'teamId'>,
): Promise<boolean> {
  if (await ownsProject(ctx, liveDoc)) return true;
  if (!liveDoc.teamId || !ctx.verifiedUserId) return false;
  const membership = await getMembership(ctx.env, liveDoc.teamId, ctx.verifiedUserId);
  return membership?.status === 'joined';
}

// May `ctx` delete this project? Exactly who manages it (managesProject). Also
// gates what the delete confirmation reads first (the shared-tabs notice).
export const mayDeleteProject = managesProject;

// The answer for a project id no LIVE row holds (docs/specs/013-workspace/trash.md):
// 410 `project_trashed` when it is in the Trash and the caller could have
// opened it (owner, joined team member, share-code holder), else the 404 a
// never-existing id gets, so the deleted state leaks nothing to a stranger.
export async function missingProject(ctx: RouteContext, projectId: string): Promise<Response> {
  const trashed = await getTrashedProjectMeta(ctx.env, projectId);
  if (!trashed) return notFound();
  const grant = await gateGrant(ctx, projectId, trashed.ownerId, trashed.teamId);
  return grant ? projectTrashed() : notFound();
}

// Owner-only resource: resolve the caller, load the project, and confirm
// the caller owns it. Returns the project, or 400 (no owner) / 404
// (missing) / 403 (foreign). 404-before-403 means a foreign id can't be
// distinguished from a missing one until ownership is proven, but once
// the row exists a non-owner gets 403 — matching every owner-only branch
// projects.ts hand-rolled (DELETE :id, /folder, /share, /share-password,
// /share/:code).
export async function requireOwnedProject(
  ctx: RouteContext,
  projectId: string,
): Promise<ProjectDTO | Response> {
  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();
  const existing = await getProject(ctx.env, projectId);
  if (!existing) return missingProject(ctx, projectId);
  if (!(await ownsProject(ctx, existing))) return forbidden();
  return existing;
}

// The share-link family's guard (docs/specs/013-workspace/team-shared-projects.md): the
// same 400 / 404 / 403 ladder as requireOwnedProject, but a joined member of a team
// project passes as well as its owner, since the team's projects are all of theirs
// to share.
export async function requireManagedProject(
  ctx: RouteContext,
  projectId: string,
): Promise<ProjectDTO | Response> {
  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();
  const existing = await getProject(ctx.env, projectId);
  if (!existing) return missingProject(ctx, projectId);
  if (!(await managesProject(ctx, existing))) return forbidden();
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

// The refusal for a Participant door (docs/specs/013-workspace/share-roles.md): no grant, 403; a grant confined
// to another tab, 404, as deniedOnTab; a grant whose level is below Participant (a Viewer), 403.
export async function deniedParticipate(
  ctx: RouteContext,
  liveDoc: { id: string; ownerId: string; teamId: string | null },
  tabId?: string,
): Promise<Response> {
  const grant = await gateGrant(ctx, liveDoc.id, liveDoc.ownerId, liveDoc.teamId);
  if (grant && grant.tabScope !== null && grant.tabScope !== tabId) return notFound();
  if (grant)
    console.info('[access-levels] participation refused', { projectId: liveDoc.id, tabId });
  return forbidden();
}

// A body whose every field is optional: the JSON object, or `{}` for an empty, unparseable or non-object body
// (`null`, a string, an array), so reading a field off it never throws. An absent body is the documented
// default on these routes, so anything that is not an object reads the same way.
export async function readOptionalBody(request: Request): Promise<Record<string, unknown>> {
  return objectOrEmpty(await request.json().catch(() => null));
}

// The request's JSON body as an object, or the 400 to return: `invalid json` when it doesn't
// parse, `expected a JSON object` when it parses to anything but a plain object.
export async function readBody(ctx: RouteContext): Promise<Record<string, unknown> | Response> {
  try {
    const body: unknown = await ctx.request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : badRequest('expected a JSON object');
  } catch {
    return badRequest('invalid json');
  }
}
