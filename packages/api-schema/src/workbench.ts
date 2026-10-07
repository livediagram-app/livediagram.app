// Workbench embeds (docs/specs/013-workspace/workbench-embeds.md, blueprint
// docs/specs/013-workspace/blueprints/workbench-embeds.md): the constants, the wire types of every
// /api/workbench route, the one origin rule, and the confinement allow-list a workbench session lives
// inside. Shared by the api worker, the live editor and the CLI, so all three decide alike.

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

// A ticket and a pairing code are 16 random bytes, base64url without padding.
export const WORKBENCH_HANDLE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

// `lvw_` and 32 random bytes as base64url without padding.
const SESSION_PATTERN = /^lvw_[A-Za-z0-9_-]{43}$/;

export function isWorkbenchSessionFormat(value: string): boolean {
  return SESSION_PATTERN.test(value);
}

// ---------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------

// `participate` is reserved for share roles (blueprint WB1); today a session is `view` or `edit`.
export type WorkbenchRole = 'view' | 'participate' | 'edit';

const LADDER: readonly WorkbenchRole[] = ['view', 'participate', 'edit'];

// The lower of the two on the ladder; no ceiling gives the role.
export function capWorkbenchRole(role: WorkbenchRole, ceiling?: WorkbenchRole): WorkbenchRole {
  if (ceiling === undefined) return role;
  return LADDER.indexOf(ceiling) < LADDER.indexOf(role) ? ceiling : role;
}

// ---------------------------------------------------------------------
// The origin rule
// ---------------------------------------------------------------------

declare const workbenchOriginBrand: unique symbol;
export type WorkbenchOrigin = string & { readonly [workbenchOriginBrand]: true };

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
] as const;
export type WorkbenchErrorCode = (typeof WORKBENCH_ERROR_CODES)[number];

// ---------------------------------------------------------------------
// Wire types (blueprint "Wire types")
// ---------------------------------------------------------------------

export type WorkbenchTicketRequest = { documentId: string; tabId?: string; origin: string };
export type WorkbenchTicketResponse = {
  url: string;
  documentId: string;
  tabId: string | null;
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
  pictureUrl: string | null;
};
export type WorkbenchSessionResponse = {
  session: string;
  documentId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
};
export type InvalidTicketReason = 'expired' | 'used' | 'unknown';
export type InvalidTicket = { error: 'invalid_ticket'; reason: InvalidTicketReason };
export type WorkbenchPairing = {
  id: string;
  tokenId: string;
  origin: string;
  name: string | null;
  pairedAt: number;
};
export type WorkbenchPairingsResponse = { pairings: WorkbenchPairing[] };
export type WorkbenchPairingRequestCreate = { origin: string; name?: string };
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
// Confinement (blueprint "A request bearing lvw_")
// ---------------------------------------------------------------------

export type WorkbenchRouteVerdict = 'allow' | 'confined' | 'other-document';

// One allowed route shape: methods and a path under /api. `:doc` must be the session's document,
// `:owner` the session's owner, `:p` any one segment (except the words in WORKBENCH_RESERVED_SEGMENTS).
type RouteShape = { methods: readonly string[]; path: readonly string[] };

const shape = (methods: string, path: string): RouteShape => ({
  methods: methods.split(','),
  path: path.split('/'),
});

export const WORKBENCH_ROUTES: readonly RouteShape[] = [
  shape('GET', 'capabilities'),
  shape('GET', 'openapi.json'),
  shape('GET', 'templates'),
  shape('GET', 'templates/:p'),
  shape('GET', 'icons'),
  shape('GET', 'schema'),
  shape('GET', 'schema/:p'),
  shape('GET', 'participants/:owner'),
  shape('GET', 'preferences'),
  shape('GET', 'custom-themes'),
  shape('GET', 'shape-libraries'),
  shape('POST', 'images'),
  shape('GET', 'images/:p'),
  shape('GET,PUT', 'documents/:doc'),
  shape('GET,PUT,DELETE', 'documents/:doc/tabs/:p'),
  shape('PUT', 'documents/:doc/tabs/:p/name'),
  shape('POST', 'documents/:doc/tabs/:p/changesets'),
  shape('POST', 'documents/:doc/changesets/:p/revert'),
  shape('GET', 'documents/:doc/changesets'),
  shape('GET', 'documents/:doc/changesets/:p'),
  shape('GET', 'documents/:doc/comments'),
  shape('GET', 'documents/:doc/tabs/:p/render.svg'),
  shape('GET', 'documents/:doc/tabs/:p/comment-pictures'),
  shape('POST', 'documents/:doc/tabs/:p/comments'),
  shape('POST', 'documents/:doc/tabs/:p/comments/:p/reply'),
  shape('POST', 'documents/:doc/tabs/:p/comments/:p/resolve'),
  shape('POST', 'documents/:doc/tabs/:p/comments/:p/reopen'),
  shape('DELETE', 'documents/:doc/tabs/:p/comments/:p'),
  shape('POST', 'documents/:doc/tabs/:p/qa'),
  shape('POST', 'documents/:doc/room-ticket'),
  shape('GET,POST', 'documents/:doc/items'),
  shape('POST', 'documents/:doc/items/bulk'),
  shape('POST,DELETE', 'documents/:doc/items/:p'),
  shape('POST', 'documents/:doc/items/:p/move'),
  shape('POST', 'documents/:doc/items/:p/vote'),
  shape('POST', 'documents/:doc/items/:p/comments'),
  shape('POST', 'documents/:doc/items/:p/comments/resolve'),
  shape('POST', 'documents/:doc/items/:p/comments/reopen'),
  shape('DELETE', 'documents/:doc/items/:p/comments/:p'),
  shape('PUT', 'documents/:doc/item-types'),
  shape('DELETE', 'workbench/sessions/current'),
];

// Words a `:p` never matches: sibling routes that share a prefix with an allowed shape but are confined
// (`GET images/usage` beside `GET images/:id`).
const WORKBENCH_RESERVED_SEGMENTS = new Set(['usage']);

function matches(
  route: RouteShape,
  rest: readonly string[],
  session: { documentId: string; ownerId: string },
) {
  if (route.path.length !== rest.length) return false;
  return route.path.every((part, i) => {
    const seg = rest[i]!;
    if (part === ':doc') return seg === session.documentId;
    if (part === ':owner') return seg === session.ownerId;
    if (part === ':p') return seg.length > 0 && !WORKBENCH_RESERVED_SEGMENTS.has(seg);
    return seg === part;
  });
}

// `segments` as the api splits the path: `['api', 'documents', ...]`. A document route naming any other
// document answers as if that document were absent, whatever follows, so nothing leaks its existence.
export function workbenchRouteVerdict(
  method: string,
  segments: readonly string[],
  session: { documentId: string; ownerId: string },
): WorkbenchRouteVerdict {
  const rest = segments.slice(1);
  if (rest[0] === 'documents' && rest.length >= 2 && rest[1] !== session.documentId) {
    return 'other-document';
  }
  const allowed = WORKBENCH_ROUTES.some(
    (route) => route.methods.includes(method) && matches(route, rest, session),
  );
  return allowed ? 'allow' : 'confined';
}
