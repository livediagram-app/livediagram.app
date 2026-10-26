import { objectOrEmpty, type WorkbenchRole } from '@liveplanner/api-schema';
// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import { capWorkbenchRole, levelAtLeast, type AccessLevel } from '@liveplanner/api-schema';
import type { TeamClaim } from '@liveworkspace/auth-client';
import type { WorkbenchReach } from '../auth/workbench-session';
import type { GrantCaller, PlanGrant } from '../index-service';
import { badRequest, forbidden, missingAuth, notFound } from '../responses';
import type { ProjectDTO, Env, PlanEnv, ShareRole } from '../types';

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
  // The teams the session's token had joined when it was opened, so the api can ask the index for a team plan's
  // grant on the owner's behalf. Absent: none.
  teams?: TeamClaim[] | null;
} & WorkbenchReach;

export type RouteContext = {
  request: Request;
  env: Env;
  url: URL;
  // Path split on '/', leading slash stripped: `['api', '<resource>', ...]`.
  segments: string[];
  // The verified account id, or null. Routes that must be
  // signed-in only (account deletion, guest->authed migration, teams)
  // read this directly rather than through `resolveOwner` so there's
  // no X-Owner-Id fallback.
  accountUserId: string | null;
  // The server-verified account id from EITHER credential: an account
  // access token, or an `lwt_` API token (whose owner is always an
  // account, docs/specs/015-api/public-api-and-tokens.md §3.3). This is the identity for team-membership
  // CONTENT access — gateRead/gateEdit and the teams-surface reads — so a
  // token reaches the same projects the app does (docs/specs/015-api/public-api-and-tokens.md §3.4). Account
  // and team ADMINISTRATION (team mutations, token management, account
  // deletion, migration) keeps requiring `accountUserId`: a leaked token
  // must not be able to manage membership or mint further credentials.
  verifiedUserId: string | null;
  // The verified `email` claim from the account access token (docs/specs/013-workspace/teams.md), or null
  // when sign-in is off, the caller is a guest, or the address is not
  // verified. Never read from a header — it
  // drives teams' invite auto-connection so it must be unforgeable.
  accountEmail: string | null;
  // The caller's id (docs/specs/014-identity/auth-and-guest-access.md): the verified account id, else a verified
  // guest token's `guest_…` id, else null (a link visitor with no identity). Resolved once in `fetch`.
  resolveOwner: () => string | null;
  // The API token the request presented, or null for a signed-in session or a guest. Only a token
  // makes a changeset an agent's, and a token may never do a whole-tab save
  // (docs/specs/024-agents/agent-changesets.md). Optional so unit tests can leave it out.
  // Its name and expiry are liveworkspace's answer when it was checked (the CLI's auth status, the workbench).
  token?: { id: string; readOnly?: boolean; name?: string | null; expiresAt?: number } | null;
  // The presenting workbench session (docs/specs/013-workspace/workbench-embeds.md), or null for every other
  // caller. Under one, `accountUserId` and `token` are null and `resolveOwner()` is the owner: a person's editor on
  // one project, never a token and never an administrator. Optional so unit tests can leave it out.
  workbench?: WorkbenchContext | null;
  // The caller's joined teams, from its token (null for a guest or a token minted before teams were in it).
  teams?: TeamClaim[] | null;
  // The browser's own bearer (an access or guest token), passed to the index as it is; null for an API token,
  // a workbench session and a link visitor with no identity.
  bearer?: string | null;
  // The index's grant on the plan this request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"):
  // the X-Index-Grant the request carried, checked, or one the worker fetched for it (routes/projects.ts). It is
  // the whole of who may do what to a plan; null or for another plan, nothing.
  grant?: PlanGrant | null;
  // Schedule background work that may outlive the response (docs/specs/014-identity/transactional-email.md email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// A RouteContext inside a plan's Durable Object (plan-room/plan-route.ts): its env reaches the plan's content.
export type PlanRouteContext = RouteContext & { env: PlanEnv };

// A link visitor's share code (X-Share-Code) and its password (X-Share-Password), as @liveworkspace/index-app
// reads them.
export { shareAccessOf, shareCodeOf } from '@liveworkspace/index-app';

// Who the index is asked for on this request's behalf (index-service.ts): an API token's or a workbench session's
// account, vouched for with this app's key, or the browser's own bearer (none for a link visitor).
export function grantCallerOf(ctx: RouteContext): GrantCaller {
  if (ctx.token || ctx.workbench) {
    const personId = ctx.verifiedUserId ?? ctx.resolveOwner() ?? '';
    return { kind: 'delegate', personId, teams: (ctx.teams ?? []).map((t) => t.id) };
  }
  return { kind: 'bearer', token: ctx.bearer ?? null };
}

// What a caller holds on a plan (docs/specs/013-workspace/share-roles.md): a level, the one tab it is confined to
// (docs/specs/013-workspace/tab-scoped-share-links.md), and the share code that granted it. All of it is the
// index's grant, read here; a workbench session holds no more than its own level.
export type ProjectGrant = {
  role: ShareRole;
  tabScope: string | null;
  shareCode: string | null;
};

export function grantOn(ctx: RouteContext, projectId: string): ProjectGrant | null {
  const grant = ctx.grant;
  if (!grant || grant.item !== projectId) return null;
  const role = ctx.workbench ? capWorkbenchRole(grant.level, ctx.workbench.level) : grant.level;
  return { role, tabScope: grant.tab, shareCode: grant.shareCode };
}

// The ladder (docs/specs/013-workspace/share-roles.md): every level holds everything below it. `tabId` names the
// tab the request touches; left off, the request is project-level and a tab-scoped grant reaches nothing there
// (fail closed, docs/specs/013-workspace/tab-scoped-share-links.md).
function holds(
  ctx: RouteContext,
  projectId: string,
  needs: AccessLevel,
  tabId: string | undefined,
): boolean {
  const grant = grantOn(ctx, projectId);
  if (!grant || !levelAtLeast(grant.role, needs)) return false;
  return grant.tabScope === null || grant.tabScope === tabId;
}

// The gates every plan route runs. The grant carries the whole decision; the owner and team arguments are
// accepted and unused.
export async function gateRead(
  ctx: RouteContext,
  projectId: string,
  _projectOwnerId?: string,
  _projectTeamId?: string | null,
  tabId?: string,
): Promise<boolean> {
  return holds(ctx, projectId, 'view', tabId);
}

// The Participant gate (docs/specs/013-workspace/share-roles.md): every write a Participant may make beside an
// Editor (comments, Q&A notes and upvotes, Plan cards, Sheet cells). A Viewer only looks, so it is refused. Agent
// presence stays on gateRead: an agent acts at its owner's level.
export async function gateParticipate(
  ctx: RouteContext,
  projectId: string,
  _projectOwnerId?: string,
  _projectTeamId?: string | null,
  tabId?: string,
): Promise<boolean> {
  return holds(ctx, projectId, 'participate', tabId);
}

export async function gateEdit(
  ctx: RouteContext,
  projectId: string,
  _projectOwnerId?: string,
  _projectTeamId?: string | null,
  tabId?: string,
): Promise<boolean> {
  return holds(ctx, projectId, 'edit', tabId);
}

// The caller's grant on a project, scope included, for the doors that narrow
// what they return to a scoped visitor's tab rather than refuse them
// (docs/specs/013-workspace/tab-scoped-share-links.md). Null = no access.
export async function gateGrant(
  ctx: RouteContext,
  projectId: string,
  _projectOwnerId?: string,
  _projectTeamId?: string | null,
): Promise<ProjectGrant | null> {
  return grantOn(ctx, projectId);
}

// The resolved caller id, or the 400 to return when no token identifies the caller.
export function requireOwner(ctx: RouteContext): string | Response {
  return ctx.resolveOwner() ?? missingAuth();
}

// Is `ctx` the plan's owner, as the plan knows it? Only the doors that show the owner more (comment authors,
// the owner's own notices) ask; who may change or share the plan is the index's.
export async function ownsProject(
  ctx: RouteContext,
  liveDoc: Pick<ProjectDTO, 'id' | 'ownerId'>,
): Promise<boolean> {
  const caller = ctx.resolveOwner();
  return caller !== null && caller === liveDoc.ownerId && grantOn(ctx, liveDoc.id) !== null;
}

// The answer for a plan id no started plan holds: the 404 a never-existing id gets. The Trash is the index's, so
// a trashed plan never gets a grant and never reaches here with one.
export async function missingProject(_ctx: RouteContext, _projectId: string): Promise<Response> {
  return notFound();
}

// A refused request on a tab: 404 when the caller's grant is confined to another tab, 403 otherwise.
export async function deniedOnTab(
  ctx: RouteContext,
  liveDoc: { id: string; ownerId: string; teamId: string | null },
): Promise<Response> {
  return grantOn(ctx, liveDoc.id) ? notFound() : forbidden();
}

// The refusal for a Participant door (docs/specs/013-workspace/share-roles.md): no grant, 403; a grant confined
// to another tab, 404, as deniedOnTab; a grant whose level is below Participant (a Viewer), 403.
export async function deniedParticipate(
  ctx: RouteContext,
  liveDoc: { id: string; ownerId: string; teamId: string | null },
  tabId?: string,
): Promise<Response> {
  const grant = grantOn(ctx, liveDoc.id);
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
