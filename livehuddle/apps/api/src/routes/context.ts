import { objectOrEmpty, type WorkbenchRole } from '@livehuddle/api-schema';
// Shared per-request context for the route handlers. The worker's
// `fetch` entry (src/index.ts) builds one of these after resolving the
// caller's identity + running the cross-cutting gates (CORS, write
// rate-limit), then dispatches on `segments[1]` to the matching
// `routes/<resource>.ts` handler. Each handler owns every request for
// its segment and returns `notFound()` for sub-paths / methods it
// doesn't recognise (preserving the original fall-through-to-404).

import { capWorkbenchRole, levelAtLeast, type AccessLevel } from '@livehuddle/api-schema';
import type { TeamClaim } from '@liveworkspace/auth-client';
import type { WorkbenchReach } from '../auth/workbench-session';
import { badRequest, forbidden, missingAuth, notFound } from '../responses';
import type { DocumentDTO, Env, DocumentEnv, ShareRole } from '../types';
import type { GrantCaller, ItemGrant } from '../index-service';

// A workbench session as the choke point resolved it (blueprint "A request bearing lvw_", "The choke point by
// scope"): one document in the document scope, the workspace (from an optional folder) in the workspace scope.
export type WorkbenchContext = {
  sessionId: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  level: WorkbenchRole;
  expiresAt: number;
  // The teams the session's token had joined when it was opened, so the api can ask the index for a team canvas's
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
  // signed-in only (account deletion, teams) read this directly rather
  // than through `resolveOwner`, which a guest also answers.
  accountUserId: string | null;
  // The server-verified account id from EITHER credential: an account
  // access token, or an `lwt_` API token (whose owner is always an
  // account, docs/specs/015-api/public-api-and-tokens.md §3.3). This is the identity for team-membership
  // CONTENT access — gateRead/gateEdit and the teams-surface reads — so a
  // token reaches the same documents the app does (docs/specs/015-api/public-api-and-tokens.md §3.4). Account
  // and team ADMINISTRATION (team mutations, token management, account
  // deletion) keeps requiring `accountUserId`: a leaked token
  // must not be able to manage membership or mint further credentials.
  verifiedUserId: string | null;
  // The verified `email` claim from the account access token (docs/specs/013-workspace/teams.md), or null
  // when sign-in is off, the caller is a guest, or the address is not
  // verified. Never read from a header — it
  // drives teams' invite auto-connection so it must be unforgeable.
  accountEmail: string | null;
  // Hybrid identity (docs/specs/014-identity/auth-and-guest-access.md): the verified account id (signed in, an
  // API token's or a workbench session's), else the guest token's id, else null. Resolved once in `fetch`.
  resolveOwner: () => string | null;
  // The API token the request presented, or null for a signed-in session or a guest. Only a token
  // makes a changeset an agent's, and a token may never do a whole-tab save
  // (docs/specs/024-agents/agent-changesets.md). Optional so unit tests can leave it out.
  // Its name and expiry are liveworkspace's answer when it was checked (the CLI's auth status, the workbench).
  token?: { id: string; readOnly?: boolean; name?: string | null; expiresAt?: number } | null;
  // The presenting workbench session (docs/specs/013-workspace/workbench-embeds.md), or null for every other
  // caller. Under one, `accountUserId` and `token` are null and `resolveOwner()` is the owner: a person's editor on
  // one document, never a token and never an administrator. Optional so unit tests can leave it out.
  workbench?: WorkbenchContext | null;
  // The verified bearer of a signed-in person or a guest (an accounts access token or guest token), passed on to
  // the index as theirs; null for an API token, a workbench session or a link visitor.
  bearer?: string | null;
  // The teams the caller is in, from their token's claim (null for a guest or a token minted without them): what
  // an API token delegates to the index with, and the list GET /api/teams answers.
  teams?: TeamClaim[] | null;
  // The index's grant on the document the request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
  // "Grants"), settled by the worker before the request reaches the document's room. Null when the caller holds
  // none; unset outside a document's own routes.
  grant?: ItemGrant | null;
  // The canvas's Community post's link as the canvas's room holds it (document-room/community-post.ts): a grant
  // through `code` is a content-only pass while the post is `open`, and no pass at all otherwise (grantOn). Unset
  // outside a canvas's own routes, and null for a canvas with no post.
  community?: { code: string; open: boolean } | null;
  // Schedule background work that may outlive the response (docs/specs/014-identity/transactional-email.md email
  // sends). Forwards to the fetch handler's ExecutionContext.waitUntil.
  // Optional so unit tests can build a RouteContext without a real
  // ExecutionContext; the production `fetch` always provides it. Call sites
  // guard with `ctx.waitUntil?.(...)`.
  waitUntil?: (promise: Promise<unknown>) => void;
};

// A RouteContext inside a document's Durable Object (document-room/document-route.ts): its env reaches the document's content.
export type DocumentRouteContext = RouteContext & { env: DocumentEnv };

// Who the index sees: an API token or workbench session delegates (the app checked the person, with the app's key),
// anyone else's own bearer goes as it is (a link visitor's is null).
export function grantCallerOf(ctx: RouteContext): GrantCaller {
  if (ctx.token || ctx.workbench) {
    const personId = ctx.verifiedUserId ?? ctx.resolveOwner() ?? '';
    return { kind: 'delegate', personId, teams: (ctx.teams ?? []).map((t) => t.id) };
  }
  return { kind: 'bearer', token: ctx.bearer ?? null };
}

// A link visitor's share code (X-Share-Code) and its password (X-Share-Password), as @liveworkspace/index-app
// reads them. The code's PRESENCE is the only honest signal that a caller arrived through a share link: a joined
// team member reads every team canvas without one.
export { shareAccessOf, shareCodeOf } from '@liveworkspace/index-app';

// What a caller holds on a canvas (docs/specs/013-workspace/share-roles.md): a level, the one tab it is confined to
// (docs/specs/013-workspace/tab-scoped-share-links.md), and the share code that granted it. All of it is the
// index's grant, read here; a workbench session holds no more than its own level.
//
// `community` marks a grant through the canvas's Community post's link (docs/specs/025-community/community.md
// "Viewing a post's document"): read-only like any view link, and a content-only pass: no realtime room and no
// comments.
export type DocumentGrant = {
  role: ShareRole;
  tabScope: string | null;
  shareCode: string | null;
  community: boolean;
};

// A Community post's link is refused unless the door passes `COMMUNITY_CONTENT` (docs/specs/025-community/
// community.md "Viewing a post's document"): the link is a content-only pass, so the canvas, its tabs, images and
// copy serve it, and comments, history, the timeline and any door added later do not. Fail closed, like the tab
// scope.
export const COMMUNITY_CONTENT = { community: true } as const;
type GateOptions = { community?: boolean };

export function grantOn(
  ctx: RouteContext,
  documentId: string,
  opts: GateOptions = {},
): DocumentGrant | null {
  const grant = ctx.grant;
  if (!grant || grant.item !== documentId) return null;
  const post = ctx.community ?? null;
  const community = grant.shareCode !== null && post !== null && grant.shareCode === post.code;
  // A post hidden after reports, off the Community, or no longer its author's own opens nothing through its link.
  if (community && (!post.open || !opts.community)) return null;
  const role = ctx.workbench ? capWorkbenchRole(grant.level, ctx.workbench.level) : grant.level;
  // A Community post's link opens to view, whatever the index's link says.
  return {
    role: community ? 'view' : role,
    tabScope: grant.tab,
    shareCode: grant.shareCode,
    community,
  };
}

// The ladder (docs/specs/013-workspace/share-roles.md): every level holds everything below it. `tabId` names the
// tab the request touches; left off, the request is canvas-level and a tab-scoped grant reaches nothing there
// (fail closed, docs/specs/013-workspace/tab-scoped-share-links.md).
function holds(
  ctx: RouteContext,
  documentId: string,
  needs: AccessLevel,
  tabId: string | undefined,
  opts: GateOptions = {},
): boolean {
  const grant = grantOn(ctx, documentId, opts);
  if (!grant || !levelAtLeast(grant.role, needs)) return false;
  return grant.tabScope === null || grant.tabScope === tabId;
}

// The gates every canvas route runs. The grant carries the whole decision; the owner and team arguments are
// accepted and unused, so a door reads the same as it always has.
export async function gateRead(
  ctx: RouteContext,
  documentId: string,
  _documentOwnerId?: string,
  _documentTeamId?: string | null,
  tabId?: string,
  opts: GateOptions = {},
): Promise<boolean> {
  return holds(ctx, documentId, 'view', tabId, opts);
}

// The Participant gate (docs/specs/013-workspace/share-roles.md): every write a Participant may make beside an
// Editor (comments, Q&A notes and upvotes). A Viewer only looks, so it is refused. Agent presence stays on
// gateRead: an agent acts at its owner's level.
export async function gateParticipate(
  ctx: RouteContext,
  documentId: string,
  _documentOwnerId?: string,
  _documentTeamId?: string | null,
  tabId?: string,
): Promise<boolean> {
  return holds(ctx, documentId, 'participate', tabId);
}

export async function gateEdit(
  ctx: RouteContext,
  documentId: string,
  _documentOwnerId?: string,
  _documentTeamId?: string | null,
  tabId?: string,
): Promise<boolean> {
  return holds(ctx, documentId, 'edit', tabId);
}

// The caller's grant on a canvas, scope included, for the doors that narrow what they return to a scoped visitor's
// tab rather than refuse them (docs/specs/013-workspace/tab-scoped-share-links.md). Null = no access. A Community
// post's link answers null unless the door passes `COMMUNITY_CONTENT`.
export async function gateGrant(
  ctx: RouteContext,
  documentId: string,
  _documentOwnerId?: string | null,
  _documentTeamId?: string | null,
  opts: GateOptions = {},
): Promise<DocumentGrant | null> {
  return grantOn(ctx, documentId, opts);
}

// The resolved caller id, or the 400 to return when no token identifies the caller.
export function requireOwner(ctx: RouteContext): string | Response {
  return ctx.resolveOwner() ?? missingAuth();
}

// Is `ctx` the canvas's owner, as the canvas knows it? Only the doors that show the owner more (comment authors,
// publishing to the Community, the owner's own notices) ask; who may change or share the canvas is the index's.
export async function ownsDocument(
  ctx: RouteContext,
  liveDoc: Pick<DocumentDTO, 'id' | 'ownerId'>,
): Promise<boolean> {
  const caller = ctx.resolveOwner();
  return caller !== null && caller === liveDoc.ownerId && grantOn(ctx, liveDoc.id) !== null;
}

// The answer for a canvas id no started canvas holds: the 404 a never-existing id gets. A canvas in the Trash never
// reaches here: its grant says so, and the room answers it 410 first (document-room/document-route.ts).
export async function missingDocument(_ctx: RouteContext, _documentId: string): Promise<Response> {
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
    console.info('[access-levels] participation refused', { documentId: liveDoc.id, tabId });
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
