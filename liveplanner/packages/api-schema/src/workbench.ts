// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md, blueprint
// docs/specs/013-workspace/blueprints/workbench-embeds.md): the constants, the wire types of every
// /api/workbench route, the one origin rule, and the confinement allow-list a workbench session lives
// inside. Shared by the api worker, the live editor and the CLI, so all three decide alike.

import { lowerLevel, type AccessLevel } from './access-levels';

// ---------------------------------------------------------------------
// Constants (blueprint "Constants and configuration")
// ---------------------------------------------------------------------

export const WORKBENCH_TICKET_TTL_MS = 60_000;
export const WORKBENCH_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const WORKBENCH_HANDSHAKE_MS = 5_000;
export const WORKBENCH_SELECTION_SETTLE_MS = 250;
export const WORKBENCH_SELECTION_MAX_REFS = 20;
export const WORKBENCH_PAIRING_TTL_MS = 10 * 60 * 1000;
export const WORKBENCH_TICKETS_PER_MINUTE = 30;
export const WORKBENCH_RENEW_LEAD_MS = 10 * 60 * 1000;
export const WORKBENCH_RENEW_RETRY_MS = 60_000;
export const WORKBENCH_TICKET_BYTES = 16;
export const WORKBENCH_SESSION_SECRET_BYTES = 32;
export const WORKBENCH_PAIRING_CODE_BYTES = 16;
export const WORKBENCH_SESSION_PREFIX = 'lvw_';
export const WORKBENCH_NAME_MAX_LENGTH = 40;
export const WORKBENCH_ORIGIN_MAX_LENGTH = 255;
export const WORKBENCH_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;

// A pairing code is 16 random bytes, base64url without padding.
export const WORKBENCH_HANDLE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// A ticket is 16 random bytes, base64url without padding, then a dot and the id of the person's workbench store
// at liveworkspace (64 hex), so it reaches their store with no one signed in.
export const WORKBENCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/;

// `lvw_` and 32 random bytes as base64url without padding, then a dot and the store's id, as a ticket.
const SESSION_PATTERN = /^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/;

export function isWorkbenchSessionFormat(value: string): boolean {
  return SESSION_PATTERN.test(value);
}

// ---------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------

// A workbench session's level is an access level (docs/specs/013-workspace/share-roles.md).
export type WorkbenchRole = AccessLevel;

// The lower of the two on the ladder; no ceiling gives the role.
export function capWorkbenchRole(role: WorkbenchRole, ceiling?: WorkbenchRole): WorkbenchRole {
  return lowerLevel(role, ceiling);
}

// ---------------------------------------------------------------------
// Scopes (docs/specs/013-workspace/workbench-embeds.md "Two scopes")
// ---------------------------------------------------------------------

// What a ticket, session or pairing reaches: one project, or the person's whole workspace.
export const WORKBENCH_SCOPES = ['project', 'workspace'] as const;
export type WorkbenchScope = (typeof WORKBENCH_SCOPES)[number];

export function isWorkbenchScope(value: unknown): value is WorkbenchScope {
  return WORKBENCH_SCOPES.some((scope) => scope === value);
}

// A workspace pairing also covers the project scope; a project pairing never covers the workspace, so reaching
// the whole workspace is always its own approval.
export function pairingCoversScope(pairing: WorkbenchScope, asked: WorkbenchScope): boolean {
  return pairing === 'workspace' || asked === 'project';
}

// ---------------------------------------------------------------------
// The origin rule
// ---------------------------------------------------------------------

declare const workbenchOriginBrand: unique symbol;
type WorkbenchOrigin = string & { readonly [workbenchOriginBrand]: true };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Exactly `scheme://host[:port]`: https anywhere, http on a loopback host only. The input must equal what
// the browser reports as the origin, so no default port, upper case or trailing slash slips through that
// `event.origin` would never match.
export function parseWorkbenchOrigin(
  input: string,
): { ok: true; origin: WorkbenchOrigin } | { ok: false } {
  if (input.length === 0 || input.length > WORKBENCH_ORIGIN_MAX_LENGTH) return { ok: false };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false };
  }
  const schemeOk =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!schemeOk) return { ok: false };
  if (url.username || url.password || url.search || url.hash) return { ok: false };
  if (url.pathname !== '/' || input.endsWith('/')) return { ok: false };
  if (input !== url.origin) return { ok: false };
  return { ok: true, origin: input as WorkbenchOrigin };
}

// ---------------------------------------------------------------------
// Refusal codes
// ---------------------------------------------------------------------

export const WORKBENCH_ERROR_CODES = [
  'invalid_origin',
  'pairing_required',
  'invalid_ticket',
  'invalid_session',
  'workbench_confined',
  'workbench_read_only',
  'token_required',
  'not_a_workbench_session',
  'pairing_answered',
  'pairing_expired',
  'invalid_value',
] as const;

// ---------------------------------------------------------------------
// Wire types (blueprint "Wire types")
// ---------------------------------------------------------------------

// `scope` absent is `project`, so the callers from before scopes read unchanged.
export type WorkbenchTicketRequest =
  | { scope?: 'project'; projectId: string; tabId?: string; origin: string }
  | { scope: 'workspace'; folderId?: string; origin: string };
export type WorkbenchTicketResponse = {
  url: string;
  projectId: string;
  tabId: string | null;
  expiresAt: number;
};
export type WorkbenchWorkspaceTicketResponse = {
  url: string;
  scope: 'workspace';
  folderId: string | null;
  expiresAt: number;
};
export type WorkbenchPairingRequired = {
  error: 'pairing_required';
  pairingUrl: string;
  expiresAt: number;
};
export type WorkbenchSessionRequest = { ticket: string };
export type WorkbenchPerson = {
  id: string;
  name: string | null;
  color: string | null;
};
export type WorkbenchSessionResponse = {
  session: string;
  origin: string;
  role: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
} & (
  | { scope: 'project'; projectId: string; folderId: null; tabId: string | null }
  | { scope: 'workspace'; projectId: null; folderId: string | null; tabId: null }
);
export type WorkbenchProjectSessionResponse = Extract<
  WorkbenchSessionResponse,
  { scope: 'project' }
>;
export type WorkbenchWorkspaceSessionResponse = Extract<
  WorkbenchSessionResponse,
  { scope: 'workspace' }
>;
export type InvalidTicketReason = 'expired' | 'used' | 'unknown';
export type InvalidTicket = { error: 'invalid_ticket'; reason: InvalidTicketReason };
export type WorkbenchPairing = {
  id: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  pairedAt: number;
};
export type WorkbenchPairingsResponse = { pairings: WorkbenchPairing[] };
export type WorkbenchPairingRequestCreate = {
  origin: string;
  name?: string;
  scope?: WorkbenchScope;
};
export type PairingRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';
export type WorkbenchPairingRequestCreated =
  | { status: 'paired'; pairing: WorkbenchPairing }
  | { status: 'pending'; pairingUrl: string; code: string; expiresAt: number; interval: number };
export type WorkbenchPairingStatusResponse = {
  status: PairingRequestStatus;
  expiresAt: number;
  interval: number;
};
export type WorkbenchPairingRequestView = {
  origin: string;
  name: string | null;
  tokenName: string | null;
  scope: WorkbenchScope;
  expiresAt: number;
  status: PairingRequestStatus;
};

// The workbench name (shown, never enforced): trimmed, 1 to WORKBENCH_NAME_MAX_LENGTH characters.
export function normaliseWorkbenchName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= WORKBENCH_NAME_MAX_LENGTH ? trimmed : null;
}

// ---------------------------------------------------------------------
// Confinement (blueprint "A request bearing lvw_", "The choke point by scope")
// ---------------------------------------------------------------------

type WorkbenchRouteVerdict = 'allow' | 'confined' | 'other-project';

// What the verdict reads of a session: its scope, its project (the project scope's only) and its owner.
export type WorkbenchConfinementSession =
  | { scope: 'project'; projectId: string; ownerId: string }
  | { scope: 'workspace'; projectId: null; ownerId: string };

// Headers that would lend a session someone else's access. The project scope refuses all three; the workspace
// scope lets a share link's code and password through, since a project shared with the person is reached by its
// link (WB53), and still refuses the guest header, so a session never acts as someone else.
export function workbenchAmbientHeaders(scope: WorkbenchScope): readonly string[] {
  return scope === 'project' ? ['X-Share-Code', 'X-Owner-Id', 'X-Share-Password'] : ['X-Owner-Id'];
}

// One allowed route shape: methods and a path under /api. `:doc` must be the session's project, `:owner` the
// session's owner, `:p` any one segment (except the words in WORKBENCH_RESERVED_SEGMENTS), and a trailing `**`
// any rest of the path, none included.
type RouteShape = { methods: readonly string[]; path: readonly string[] };

const shape = (methods: string, path: string): RouteShape => ({
  methods: methods.split(','),
  path: path.split('/'),
});

const ALL_METHODS = 'GET,POST,PUT,DELETE';

// The project scope: what the editor of one project needs.
const WORKBENCH_ROUTES: readonly RouteShape[] = [
  shape('GET', 'capabilities'),
  shape('GET', 'openapi.json'),
  shape('GET', 'templates'),
  shape('GET', 'templates/:p'),
  shape('GET', 'schema'),
  shape('GET', 'schema/:p'),
  shape('GET', 'participants/:owner'),
  shape('GET', 'preferences'),
  shape('GET,PUT', 'projects/:doc'),
  shape('GET,PUT,DELETE', 'projects/:doc/tabs/:p'),
  shape('PUT', 'projects/:doc/tabs/:p/name'),
  shape('POST', 'projects/:doc/tabs/:p/changesets'),
  shape('POST', 'projects/:doc/changesets/:p/revert'),
  shape('GET', 'projects/:doc/changesets'),
  shape('GET', 'projects/:doc/changesets/:p'),
  shape('GET', 'projects/:doc/comments'),
  shape('GET', 'projects/:doc/tabs/:p/render.svg'),
  shape('POST', 'projects/:doc/tabs/:p/comments'),
  shape('POST', 'projects/:doc/tabs/:p/comments/:p/reply'),
  shape('POST', 'projects/:doc/tabs/:p/comments/:p/resolve'),
  shape('POST', 'projects/:doc/tabs/:p/comments/:p/reopen'),
  shape('DELETE', 'projects/:doc/tabs/:p/comments/:p'),
  shape('POST', 'projects/:doc/room-ticket'),
  shape('GET,POST', 'projects/:doc/items'),
  shape('POST', 'projects/:doc/items/bulk'),
  shape('POST,DELETE', 'projects/:doc/items/:p'),
  shape('POST', 'projects/:doc/items/:p/move'),
  shape('POST', 'projects/:doc/items/:p/vote'),
  shape('POST', 'projects/:doc/items/:p/comments'),
  shape('POST', 'projects/:doc/items/:p/comments/resolve'),
  shape('POST', 'projects/:doc/items/:p/comments/reopen'),
  shape('DELETE', 'projects/:doc/items/:p/comments/:p'),
  shape('PUT', 'projects/:doc/item-types'),
  shape('DELETE', 'workbench/sessions/current'),
];

// The workspace scope: everything the Explorer does, and the editor of every project in it. Never the account
// (profile, preferences' writes, the guest migration, tokens and pairings, team administration, the account, the AI
// assistant), and never a route the minting token could not call (WB51).
const WORKSPACE_ROUTES: readonly RouteShape[] = [
  shape('GET', 'capabilities'),
  shape('GET', 'openapi.json'),
  shape('GET', 'templates/**'),
  shape('GET', 'schema/**'),
  shape('GET', 'preferences'),
  shape('GET', 'participants/:owner'),
  shape('GET', 'share/**'),
  ...['projects', 'folders', 'trash'].map((resource) => shape(ALL_METHODS, `${resource}/**`)),
  shape('GET', 'teams'),
  shape('GET', 'teams/:p/library'),
  shape('DELETE', 'workbench/sessions/current'),
];

// Inside an allowed workspace resource, the door that stays closed: an agent's presence.
const WORKSPACE_CLOSED: readonly RouteShape[] = [
  shape(ALL_METHODS, 'projects/:p/tabs/:p/presence'),
];

// Words a `:p` never matches: sibling routes that share a prefix with an allowed shape but are confined
// (`GET teams/invites` beside `GET teams/:id`).
const WORKBENCH_RESERVED_SEGMENTS = new Set(['invites', 'invite-link', 'invite-decline']);

function matches(
  route: RouteShape,
  rest: readonly string[],
  session: WorkbenchConfinementSession,
): boolean {
  const wild = route.path.at(-1) === '**';
  const fixed = wild ? route.path.slice(0, -1) : route.path;
  if (wild ? rest.length < fixed.length : rest.length !== fixed.length) return false;
  return fixed.every((part, i) => {
    const seg = rest[i]!;
    if (part === ':doc') return seg === session.projectId;
    if (part === ':owner') return seg === session.ownerId;
    if (part === ':p') return seg.length > 0 && !WORKBENCH_RESERVED_SEGMENTS.has(seg);
    return seg === part;
  });
}

const anyMatches = (
  routes: readonly RouteShape[],
  method: string,
  rest: readonly string[],
  session: WorkbenchConfinementSession,
) => routes.some((route) => route.methods.includes(method) && matches(route, rest, session));

// `segments` as the api splits the path: `['api', 'projects', ...]`. In the project scope, a project route naming
// any other project answers as if that project were absent, whatever follows, so nothing leaks its existence. In
// the workspace scope every project is the person's to try: the route decides, with the owner's identity.
export function workbenchRouteVerdict(
  method: string,
  segments: readonly string[],
  session: WorkbenchConfinementSession,
): WorkbenchRouteVerdict {
  const rest = segments.slice(1);
  if (session.scope === 'workspace') {
    const allowed =
      anyMatches(WORKSPACE_ROUTES, method, rest, session) &&
      !anyMatches(WORKSPACE_CLOSED, method, rest, session);
    return allowed ? 'allow' : 'confined';
  }
  if (rest[0] === 'projects' && rest.length >= 2 && rest[1] !== session.projectId) {
    return 'other-project';
  }
  return anyMatches(WORKBENCH_ROUTES, method, rest, session) ? 'allow' : 'confined';
}
