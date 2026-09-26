// HTTP/WS plumbing shared by every api-client domain module: base URL,
// the hybrid-identity header builder, the response-handling helpers, the
// shared DELETE shape, and the module-level token / share-password
// state. The per-domain call collections (diagrams, tabs, share, …)
// import from here; callers go through the lib/api-client.ts barrel.
import type {
  ApiToken,
  ChangeLogEntry,
  CustomTheme,
  Diagram,
  Folder,
  ShareLink,
  ShareRole,
} from '@livediagram/api-schema';
import { isClerkIdShape } from '@livediagram/api-schema';
import { stampTabKind, type Tab } from '@livediagram/diagram';
import { readLocalStorageSafe, writeLocalStorageSafe } from '../local-storage-safe';
import { getGuestSelfSig } from '../local-identity';
import { notifyApiWrite } from './write-signal';
// Every non-2xx the expectOk* helpers throw, and every fetch that rejects in
// apiFetch, is reported through here (docs/specs/017-telemetry/telemetry.md 'Error').
import {
  markReported,
  reportApiError,
  reportNetworkError,
  reportNoSessionToken,
} from './error-report';

// `API_BASE` resolution:
//   1. `NEXT_PUBLIC_API_BASE` env var if set — used for local dev (e.g.
//      `https://www.livediagram.app/api` to hit prod, or
//      `http://localhost:8787/api` to point at a local `wrangler dev`
//      session of `@livediagram/api`). Baked into the static export at
//      build time so it works in deployed builds too.
//   2. Default `/api` — same-origin, served by the router worker in
//      production (router stitches the api worker onto the same
//      hostname). This is what the deployed live app uses.
//
// All requests carry an `X-Owner-Id` header set to the current
// participant's id — the API uses it as the diagram-owner filter and
// for create-time `owner_id` — unless a Clerk token provider is wired
// up (see below), in which case a Bearer token replaces it.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Hard cap on how long the Explorer's diagram-list spinner spins before
// we give up and show whatever we have. Both mount paths that load the
// list (the editor and the new-diagram screen) arm this same safety
// timeout, so it lives here next to the list-load calls.
export const DIAGRAM_LIST_LOAD_SAFETY_MS = 10_000;

// WebSocket counterpart of API_BASE. Converts http(s):// to ws(s):// for
// absolute bases; for the same-origin default it builds from
// `window.location` at call time (so SSR-safe modules can still import
// this file).
export function wsUrl(path: string): string {
  if (API_BASE.startsWith('http://')) {
    return `ws://${API_BASE.slice('http://'.length)}${path}`;
  }
  if (API_BASE.startsWith('https://')) {
    return `wss://${API_BASE.slice('https://'.length)}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${API_BASE}${path}`;
}

// Every api request goes through here rather than bare `fetch` so a
// successful WRITE can be announced (write-signal.ts): the Timeline
// re-reads itself off that signal, which is what lets a delete or a
// rename show up on the feed without a browser refresh (docs/specs/013-workspace/timeline.md
// §2.4b). Reads stay silent, and so do the feed's own endpoints —
// dismissing a card must not make the feed re-read itself to notice.
//
// Transparent otherwise: same arguments, same Response, and a network
// failure still throws to the caller before any signal is raised.
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    // The one place that sees a request fail before any response exists.
    reportNetworkError(method, input, err);
    throw err;
  }
  if (method !== 'GET' && res.ok && !isTimelinePath(input)) notifyApiWrite();
  return res;
}

function isTimelinePath(url: string): boolean {
  return url.startsWith(`${API_BASE}/timeline`);
}

// Envelope shapes the API wraps payloads in. The canonical inner
// types come from `@livediagram/api-schema`, as do the envelopes the
// MCP server reads too (DiagramResponse, TabResponse, ...); the ones
// below are the editor-only glue for `expectOk` to destructure.
export type FolderResponse = { folder: Folder };
export type FoldersResponse = { folders: Folder[] };
export type CustomThemeResponse = { theme: CustomTheme };
export type CustomThemesResponse = { themes: CustomTheme[] };
export type TokensResponse = { tokens: ApiToken[] };
// POST /api/tokens returns the one-time plaintext secret alongside the new
// token's public metadata (the secret is never retrievable again).
export type CreateTokenResponse = {
  token: string;
  id: string;
  name: string | null;
  expiresAt: number;
};
// The share-links list doubles as the owner's read of the diagram's
// share password (docs/specs/013-workspace/share-password.md): owner-only endpoint, so it's safe in the
// clear. `password` is null when the diagram has no password.
export type ShareLinksResponse = { links: ShareLink[]; password: string | null };
export type SharePasswordResponse = { password: string | null };
export type ChangeLogListResponse = { entries: ChangeLogEntry[] };
export type ChangeLogAppendResponse = { entry: ChangeLogEntry };
export type ParticipantResponse = {
  participant: { id: string; name: string; color: string; createdAt: number };
};

// Result of resolving a share code (docs/specs/013-workspace/share-password.md). A protected diagram
// returns `passwordRequired` instead of the diagram until the visitor
// supplies the matching password; `invalid` is true only when a wrong
// password was submitted (vs none yet), so the gate can show an error.
export type SharedDiagramResolution =
  { diagram: Diagram; role: ShareRole } | { passwordRequired: true; invalid: boolean };

// Hybrid identity (docs/specs/014-identity/auth-and-guest-access.md, docs/specs/015-api/api.md). When a token provider has been
// registered via `setTokenProvider` and resolves to a non-null Clerk
// session token, every request goes out with
// `Authorization: Bearer <jwt>` and NO `X-Owner-Id` — the api worker
// verifies the token, derives the owner from the `sub` claim, and
// ignores the legacy header. Without a provider (or when the provider
// resolves to null — guest, or signed out), requests go out with
// `X-Owner-Id: <participant-id>` as before.
//
// Module-level state (rather than threading a tokenProvider through
// 22 function signatures) because livediagram ships only as a static
// export — single browser tab, single-threaded, single Clerk session
// per page load. useClerkApiBootstrap wires it up once in a layout effect
// (`setTokenProvider((opts) => getToken(opts))`) and clears on unmount.
// Tests reset between cases via the same setter.
//
// Visitors on a share URL include their own participant id PLUS the
// share code that admitted them in `X-Share-Code` — the api checks
// the code's role before allowing the write. Share-code visitors who
// happen to also be signed in send Bearer + X-Share-Code; the
// per-link role still gates write access.
//
// `body: true` adds `Content-Type: application/json` for write
// requests; GETs / DELETEs omit it.
// `skipCache` mirrors Clerk's `getToken({ skipCache })`: mint a fresh token
// rather than return the cached one.
type TokenProvider = (opts?: { skipCache?: boolean }) => Promise<string | null>;

let currentTokenProvider: TokenProvider | null = null;

// The most recent token the provider returned, kept for the ONE caller
// that can't await: the `beforeunload` save beacon (flushDiagramSavesBeacon).
// The provider is async (Clerk may refresh over the network), so during
// page teardown it's unusable — but the editor autosaves every ~600ms
// while editing, so this cache is at most seconds old exactly when the
// beacon needs it. Cleared with the provider on sign-out/unmount so a
// signed-out tab can't flush with a dead identity.
let lastKnownToken: string | null = null;

// Register / clear the Clerk token provider (hooks/persistence/useClerkApiBootstrap.ts).
// Pass `null` to clear (sign-out / unmount).
export function setTokenProvider(provider: TokenProvider | null): void {
  currentTokenProvider = provider;
  // Clear on EVERY provider change, not just sign-out: a replaced
  // provider means the cached token came from a session we no longer
  // trust. The next request (autosave runs every ~600ms while editing)
  // refills it from the new provider.
  lastKnownToken = null;
}

// Synchronous read of the last token apiHeaders fetched — for the
// unload beacon only. Everything else must go through apiHeaders (which
// refreshes via the async provider).
export function getLastKnownToken(): string | null {
  return lastKnownToken;
}

// Share password for the current visitor session (docs/specs/013-workspace/share-password.md). Same
// module-level rationale as the token provider: rather than thread the
// password through every call signature, the viewer sets it once after
// passing the password gate and `apiHeaders` (HTTP) + `connectRoom`
// (WebSocket) attach it automatically. Owners never set it, so their
// requests never carry it. Null = no password in play.
let sessionSharePassword: string | null = null;
export function setSessionSharePassword(password: string | null): void {
  sessionSharePassword = password && password.length > 0 ? password : null;
}
export function getSessionSharePassword(): string | null {
  return sessionSharePassword;
}

// localStorage cache so a returning visitor on a protected diagram
// doesn't have to retype the password every load. Keyed by share code
// rather than diagram id because the diagram id only resolves AFTER
// the gate is passed; the share code is what the URL carries on
// arrival. Entry lifetime is bounded by the share code's validity:
//   - Code revoked: apiLoadShared returns null, no cache read happens
//     on later loads anyway (the bootstrap surfaces NotFound first).
//   - Password rotated: the cached value comes back from the server
//     as passwordRequired { invalid: true }, the bootstrap clears the
//     entry, and the gate prompts the visitor afresh.
// Threat model (docs/specs/013-workspace/share-password.md) is anti-URL-guessing, not cryptographic
// protection of user data; storing plain text mirrors what the api
// worker already does in D1. The owner cleartext-reads it on the
// Share dialog anyway.
const SHARE_PASSWORD_CACHE_PREFIX = 'livediagram:share-password:';
export function readCachedSharePassword(shareCode: string): string | null {
  const raw = readLocalStorageSafe(`${SHARE_PASSWORD_CACHE_PREFIX}${shareCode}`);
  return raw && raw.length > 0 ? raw : null;
}
export function writeCachedSharePassword(shareCode: string, password: string | null): void {
  const key = `${SHARE_PASSWORD_CACHE_PREFIX}${shareCode}`;
  if (password && password.length > 0) writeLocalStorageSafe(key, password);
  else writeLocalStorageSafe(key, '');
}

// Exported for direct testing of the hybrid identity gate (docs/specs/014-identity/auth-and-guest-access.md):
// Bearer token wins when present, X-Owner-Id is the fallback, and the
// two MUST NOT coexist on a single request (an api worker that sees
// both would derive owner from the JWT and silently ignore the header
// , which is fine for happy paths but leaves a confusing footprint in
// audit logs). Internal callers still get the same return type, so
// the export is additive.
// Thrown instead of sending a request that is certain to be refused: a
// signed-in client (its owner id is a Clerk account id) that has no session
// token to prove it. The worker rejects an account id in the guest header
// (401 account_id_not_a_guest_credential), so sending it only turns an auth
// problem into what looks like a network one.
export class SessionTokenUnavailableError extends Error {
  constructor() {
    super('no session token for a signed-in owner');
    this.name = 'SessionTokenUnavailableError';
  }
}

// The identity half of every request, shared by apiHeaders (async) and the
// unload beacon (sync, off the cached token). Bearer and X-Owner-Id are
// mutually exclusive, and an account id never rides as the guest header.
export function identityHeaders(ownerId: string, token: string | null): Record<string, string> {
  if (token) return { Authorization: `Bearer ${token}` };
  if (isClerkIdShape(ownerId)) throw new SessionTokenUnavailableError();
  // Proof of possession for the guest id (docs/specs/015-api/public-api-and-tokens.md
  // section 4): the api worker can require a valid signature on owner-scoped
  // routes, which a harvested id wouldn't have. Absent for legacy unsigned
  // guests and self-hosts with signing disabled.
  const sig = getGuestSelfSig();
  return sig ? { 'X-Owner-Id': ownerId, 'X-Owner-Sig': sig } : { 'X-Owner-Id': ownerId };
}

// Clerk's getToken() can resolve null for a moment on a live session, so a
// null gets one fresh attempt that bypasses Clerk's token cache.
async function resolveToken(): Promise<string | null> {
  if (!currentTokenProvider) return null;
  return (await currentTokenProvider()) ?? (await currentTokenProvider({ skipCache: true }));
}

export async function apiHeaders(
  ownerId: string,
  // `extra` is merged last, for the handful of routes that carry a declarative
  // header of their own (X-Allow-Empty, the Offline Mode conversion marker).
  opts: { share?: string | null; body?: boolean; extra?: Record<string, string> } = {},
): Promise<HeadersInit> {
  const token = await resolveToken();
  // Mirror into the sync cache for the unload beacon (see
  // getLastKnownToken), including null, so a session that lapsed
  // mid-page doesn't leave a stale Bearer for the flush.
  lastKnownToken = token;
  let h: Record<string, string>;
  try {
    h = identityHeaders(ownerId, token);
  } catch (err) {
    reportNoSessionToken();
    markReported(err);
    throw err;
  }
  if (opts.body) h['Content-Type'] = 'application/json';
  if (opts.share) h['X-Share-Code'] = opts.share;
  // Share password (docs/specs/013-workspace/share-password.md) rides on every request once the visitor
  // has passed the gate; the api ignores it unless the diagram is
  // protected + accessed via a share code. Owners never set it.
  if (sessionSharePassword) h['X-Share-Password'] = sessionSharePassword;
  return { ...h, ...opts.extra };
}

// The error every non-2xx response throws. Carries the HTTP `status`
// AND the api worker's `error` token (`code`) so callers can branch on
// the specific rule that fired (`forbidden` vs `admin_required`,
// `password_invalid`, `gallery_full`, …) instead of re-fetching or
// guessing from the status alone. Before this, every helper threw a
// bare `Error` whose message embedded the status and DROPPED the
// `error` field — the api worker's snake_case error envelope
// (responses.ts) reached the client and went straight in the bin.
//
// `message` keeps the exact `${action} failed: ${status}` shape the
// helpers always threw, so logs and any string-matching callers are
// unaffected; `status` / `code` are purely additive.
export class ApiError extends Error {
  readonly action: string;
  readonly status: number;
  readonly code: string | null;
  constructor(action: string, status: number, code: string | null) {
    super(`${action} failed: ${status}`);
    this.name = 'ApiError';
    this.action = action;
    this.status = status;
    this.code = code;
  }
}

// Pull the api worker's `error` token out of a failed response body
// without disturbing the caller's own `res.json()` (we read a clone).
// Tolerant of empty / non-JSON bodies (503 from a missing binding,
// network-level failures) — returns null rather than throwing a second
// error on top of the first.
export async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

// The ApiError for a non-2xx, reported to error telemetry on the way out.
async function failedResponse(res: Response, action: string): Promise<ApiError> {
  const code = await readErrorCode(res);
  reportApiError(res.status, action, code);
  const err = new ApiError(action, res.status, code);
  markReported(err);
  return err;
}

// Response-handling shape every fetch call here used to inline: throw
// an `ApiError` (status + the worker's error token) on non-2xx,
// otherwise parse JSON. The `action` string gets baked into the thrown
// message so debugging keeps the caller's intent without a stack walk.
export async function expectOk<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    throw await failedResponse(res, action);
  }
  return (await res.json()) as T;
}

// Same as `expectOk`, but 404 means "doesn't exist" not "broken" —
// used by read paths where a missing row is a legitimate result the
// caller wants to handle (welcome flow, share-resolution etc.)
export async function expectOkOrNull<T>(res: Response, action: string): Promise<T | null> {
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await failedResponse(res, action);
  }
  return (await res.json()) as T;
}

// For endpoints with no response body (DELETE, write-only PUT). Same
// error-on-non-ok contract; nothing to return.
export async function expectOkVoid(res: Response, action: string): Promise<void> {
  if (!res.ok) {
    throw await failedResponse(res, action);
  }
}

// DELETE that tolerates 404 — used everywhere "remove this if it
// exists" is the semantic. A racing concurrent delete shouldn't
// throw.
async function expectOkOr404Void(res: Response, action: string): Promise<void> {
  if (!res.ok && res.status !== 404) {
    throw await failedResponse(res, action);
  }
}

// Shared DELETE shape. Every apiDelete*-style endpoint in this file
// (8 callers at the time of writing) did the same three things:
// fetch with method DELETE + apiHeaders, then either expectOkOr404Void
// (the common "remove this if it exists" semantic) or expectOkVoid
// (the rarer "404 should surface as a failure" case). Centralising
// that here means a new DELETE caller never has to think about which
// helper to reach for, and the share-code wiring is opt-in via the
// `share` field instead of a 4th positional argument on every site.
export async function apiDelete(
  url: string,
  ownerId: string,
  opts: {
    action: string;
    // Forwarded to apiHeaders when present. Skip the field (or pass
    // null) for endpoints that don't accept a share-code path.
    share?: string | null;
    // Defaults to true: most DELETEs are idempotent ("if it exists,
    // remove it") and a racing concurrent delete should NOT throw.
    // Pass `false` to require a successful 2xx and surface 404 as a
    // real error.
    allow404?: boolean;
    // Declarative markers this DELETE carries, e.g. the Offline Mode
    // conversion header — without one the worker cannot tell "take offline"
    // from a real delete and records the wrong timeline event.
    extra?: Record<string, string>;
    // When this DELETE ends an entity the Timeline narrates (a diagram, a
    // folder, a theme, a team), name it in the feed's terms so the feed
    // can drop the entity's earlier cards at once, the way the worker's
    // cascade does server-side (docs/specs/013-workspace/timeline.md §3.5). Omit for a DELETE that
    // merely changes something (a share link, a favourite).
    purge?: { sourceType: string; sourceId: string };
  },
): Promise<void> {
  const res = await apiFetch(url, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, {
      ...(opts.share === undefined ? {} : { share: opts.share }),
      ...(opts.extra ? { extra: opts.extra } : {}),
    }),
  });
  if (opts.allow404 ?? true) {
    await expectOkOr404Void(res, opts.action);
  } else {
    await expectOkVoid(res, opts.action);
  }
  if (opts.purge && res.ok) notifyApiWrite({ purge: opts.purge });
}

// Strip fields that ride on the Tab type for the editor's convenience
// but must never enter the persisted tab body (`tabs.data`):
//   - `templateChosen` — UI-only (have we dismissed the per-tab
//     template picker yet?); a pure frontend concern.
//   - `folder` — per-diagram membership (docs/specs/006-diagram/tab-folders.md) that lives on the
//     diagram_tabs link, carried via the meta/reorder path. Leaking it
//     into the shared body would make a folder follow the tab into
//     every diagram it's shared into, breaking per-diagram scope.
// Shared by apiCreateDiagram + apiSaveTab.
// The single normalisation every tab passes through on its way to the wire:
// strip the UI-only fields, and stamp the board kind (docs/specs/021-event-storming/event-storming.md).
//
// The kind is stamped HERE rather than only at the editor's commit choke
// point because several mutation paths reach persistence — the history
// commit, the non-undoable session tick, a remote apply — and a field whose
// presence depends on which one ran is a field no reader can trust.
// `stampTabKind` resolves a legacy board by its layer, so a pre-`kind`
// workshop board is never branded an ordinary diagram on its next save.
export function tabForWire(tab: Tab): Tab {
  return stampTabKind(stripUiTabFields(tab));
}

export function stripUiTabFields(tab: Tab): Tab {
  if (tab.templateChosen === undefined && tab.folder === undefined) return tab;
  const { templateChosen: _tc, folder: _f, ...rest } = tab;
  void _tc;
  void _f;
  return rest as Tab;
}
