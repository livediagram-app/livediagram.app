import type {
  AiConversationTurn,
  AiMode,
  AiRequest,
  CapabilitiesResponse,
  ChangeLogEntry,
  ChangeLogKind,
  Diagram,
  DiagramSummary,
  Folder,
  ImageSummary,
  RoomIncoming,
  RoomOp,
  RoomOutgoing,
  ShareLink,
  ShareRole,
  TabRecord,
  TabSummary,
} from '@livediagram/api-schema';
import type { Element, Tab } from '@livediagram/diagram';
import { dedupeInFlight } from './dedupe';
import type { Participant } from './identity';
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

// Re-export the wire-format types under the names the live app has
// historically used so callers (editor-page.tsx, new/page.tsx, etc.)
// keep their existing imports. The canonical definitions live in
// `@livediagram/api-schema`, see that package's index.ts for the
// shapes and per-type rationale. `RoomIncoming`, `RoomOp`, and
// `RoomOutgoing` are imported and used internally below but no
// caller imports them through api-client today, so they stay
// package-local (callers go to `@livediagram/api-schema` directly
// when they need the wire types).
export type {
  ChangeLogEntry,
  ChangeLogKind,
  DiagramSummary,
  Folder,
  ImageSummary,
  ShareLink,
  ShareRole,
};

// Single HTTP/WS client for the livediagram API.
//
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
// for create-time `owner_id`. There's no auth gate yet; this is the
// hook that Clerk will replace in the post-prototype phase.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// WebSocket counterpart of API_BASE. Converts http(s):// to ws(s):// for
// absolute bases; for the same-origin default it builds from
// `window.location` at call time (so SSR-safe modules can still import
// this file).
function wsUrl(path: string): string {
  if (API_BASE.startsWith('http://')) {
    return `ws://${API_BASE.slice('http://'.length)}${path}`;
  }
  if (API_BASE.startsWith('https://')) {
    return `wss://${API_BASE.slice('https://'.length)}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${API_BASE}${path}`;
}

// Envelope shapes the API wraps payloads in. The canonical inner
// types come from `@livediagram/api-schema`; these envelopes are
// purely client-side glue for `expectOk` to destructure.
type DiagramResponse = { diagram: Diagram };
type TabResponse = { tab: TabRecord };
type ListResponse = { diagrams: DiagramSummary[] };
type FolderResponse = { folder: Folder };
type FoldersResponse = { folders: Folder[] };
type ShareLinkResponse = { link: ShareLink };
// The share-links list doubles as the owner's read of the diagram's
// share password (spec/24): owner-only endpoint, so it's safe in the
// clear. `password` is null when the diagram has no password.
type ShareLinksResponse = { links: ShareLink[]; password: string | null };
type SharePasswordResponse = { password: string | null };
type ChangeLogListResponse = { entries: ChangeLogEntry[] };
type ChangeLogAppendResponse = { entry: ChangeLogEntry };
type ParticipantResponse = {
  participant: { id: string; name: string; color: string; createdAt: number };
};

// Result of resolving a share code (spec/24). A protected diagram
// returns `passwordRequired` instead of the diagram until the visitor
// supplies the matching password; `invalid` is true only when a wrong
// password was submitted (vs none yet), so the gate can show an error.
type SharedDiagramResolution =
  | { diagram: Diagram; role: ShareRole }
  | { passwordRequired: true; invalid: boolean };

// Hybrid identity (spec/04, spec/11). When a token provider has been
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
// per page load. The editor wires it up once in a `useEffect`
// (`setTokenProvider(() => getToken())`) and clears on unmount.
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
type TokenProvider = () => Promise<string | null>;

let currentTokenProvider: TokenProvider | null = null;

// Register / clear the Clerk token provider. Call sites:
//   - `apps/live/app/diagram/[id]/editor-page.tsx`: useEffect with
//     `setTokenProvider(() => getToken())` and a cleanup that clears
//     it.
//   - `apps/live/app/new/page.tsx`: same pattern.
// Pass `null` to clear (sign-out / unmount).
export function setTokenProvider(provider: TokenProvider | null): void {
  currentTokenProvider = provider;
}

// Share password for the current visitor session (spec/24). Same
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
// Threat model (spec/24) is anti-URL-guessing, not cryptographic
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

// Exported for direct testing of the hybrid identity gate (spec/04):
// Bearer token wins when present, X-Owner-Id is the fallback, and the
// two MUST NOT coexist on a single request (an api worker that sees
// both would derive owner from the JWT and silently ignore the header
// , which is fine for happy paths but leaves a confusing footprint in
// audit logs). Internal callers still get the same return type, so
// the export is additive.
export async function apiHeaders(
  ownerId: string,
  opts: { share?: string | null; body?: boolean } = {},
): Promise<HeadersInit> {
  const h: Record<string, string> = {};
  const token = currentTokenProvider ? await currentTokenProvider() : null;
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  } else {
    h['X-Owner-Id'] = ownerId;
  }
  if (opts.body) h['Content-Type'] = 'application/json';
  if (opts.share) h['X-Share-Code'] = opts.share;
  // Share password (spec/24) rides on every request once the visitor
  // has passed the gate; the api ignores it unless the diagram is
  // protected + accessed via a share code. Owners never set it.
  if (sessionSharePassword) h['X-Share-Password'] = sessionSharePassword;
  return h;
}

// Response-handling shape every fetch call here used to inline:
// throw a labelled Error on non-2xx, otherwise parse JSON. The `action`
// string gets baked into the thrown message so debugging keeps the
// caller's intent without a stack walk.
async function expectOk<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return (await res.json()) as T;
}

// Same as `expectOk`, but 404 means "doesn't exist" not "broken" —
// used by read paths where a missing row is a legitimate result the
// caller wants to handle (welcome flow, share-resolution etc.)
async function expectOkOrNull<T>(res: Response, action: string): Promise<T | null> {
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return (await res.json()) as T;
}

// For endpoints with no response body (DELETE, write-only PUT). Same
// error-on-non-ok contract; nothing to return.
async function expectOkVoid(res: Response, action: string): Promise<void> {
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
}

// DELETE that tolerates 404 — used everywhere "remove this if it
// exists" is the semantic. A racing concurrent delete shouldn't
// throw.
async function expectOkOr404Void(res: Response, action: string): Promise<void> {
  if (!res.ok && res.status !== 404) throw new Error(`${action} failed: ${res.status}`);
}

// Shared DELETE shape. Every apiDelete*-style endpoint in this file
// (8 callers at the time of writing) did the same three things:
// fetch with method DELETE + apiHeaders, then either expectOkOr404Void
// (the common "remove this if it exists" semantic) or expectOkVoid
// (the rarer "404 should surface as a failure" case). Centralising
// that here means a new DELETE caller never has to think about which
// helper to reach for, and the share-code wiring is opt-in via the
// `share` field instead of a 4th positional argument on every site.
async function apiDelete(
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
  },
): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, opts.share === undefined ? {} : { share: opts.share }),
  });
  if (opts.allow404 ?? true) {
    await expectOkOr404Void(res, opts.action);
  } else {
    await expectOkVoid(res, opts.action);
  }
}

// Deduped on `${ownerId}|${id}`: the editor mounts and React Strict
// Mode in dev double-invokes its hydration effect, so this fires
// twice on first paint. With dedup, the second call receives the
// in-flight promise instead of opening a second request to the
// same diagram.
async function _apiLoadDiagram(ownerId: string, id: string): Promise<Diagram | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<DiagramResponse>(res, 'load');
  return body?.diagram ?? null;
}
export const apiLoadDiagram = dedupeInFlight(_apiLoadDiagram, (ownerId, id) => `${ownerId}|${id}`);

// Resolve a share code to a full diagram + the role granted by that
// code. Visitors landing on `/live/diagram/shared?s=<code>` use
// this; revoked codes return 404 from the API. Deduped by `${code}|
// ${ownerId}` so Strict Mode's double-invoke doesn't fire two share
// lookups for the same visitor, while a different visitor on the
// same code still gets its own lookup. The visitor's ownerId is
// passed so the api worker can recognise them and record the visit
// into shared_with; without it the worker can't identify the
// visitor and the "Shared with you" list stays empty.
async function _apiLoadShared(
  code: string,
  ownerId: string,
): Promise<SharedDiagramResolution | null> {
  const res = await fetch(`${API_BASE}/share/${code}`, {
    headers: await apiHeaders(ownerId, { share: null }),
  });
  // Password gate (spec/24): 401 = the diagram is protected and we sent
  // no (or no longer-valid) password; 403 = we sent a wrong one. Both
  // surface as `passwordRequired` so the editor shows the gate; only
  // 403 flags `invalid` so it can show an error line. The password the
  // visitor enters next is attached automatically by apiHeaders.
  if (res.status === 401 || res.status === 403) {
    return { passwordRequired: true, invalid: res.status === 403 };
  }
  const body = await expectOkOrNull<DiagramResponse & { role?: ShareRole }>(res, 'load shared');
  if (!body) return null;
  return {
    diagram: body.diagram,
    role: body.role === 'view' ? 'view' : 'edit',
  };
}
export const apiLoadShared = dedupeInFlight(
  _apiLoadShared,
  (code, ownerId) => `${code}|${ownerId}`,
);

// ---------------------------------------------------------------------
// Change log (per-diagram audit) — see specs/12-activity-and-audit.md
// ---------------------------------------------------------------------

// Deduped on `${ownerId}|${id}|${shareCode ?? ''}`: fires on editor
// mount alongside apiLoadDiagram; React Strict Mode doubles the
// effect. A share-link visitor and the owner are different code
// paths (different shareCode) so the key includes it to keep them
// independent.
async function _apiListChangeLog(
  ownerId: string,
  id: string,
  shareCode?: string | null,
): Promise<ChangeLogEntry[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/log`, {
    headers: await apiHeaders(ownerId, { share: shareCode ?? null }),
  });
  const { entries } = await expectOk<ChangeLogListResponse>(res, 'list change log');
  return entries;
}
export const apiListChangeLog = dedupeInFlight(
  _apiListChangeLog,
  (ownerId, id, shareCode) => `${ownerId}|${id}|${shareCode ?? ''}`,
);

export async function apiAppendChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entry: ChangeLogEntry,
  shareCode: string | null = null,
): Promise<ChangeLogEntry> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(entry),
  });
  const { entry: stored } = await expectOk<ChangeLogAppendResponse>(res, 'append change log');
  return stored;
}

export async function apiDeleteChangeLogForTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/log/tab/${tabId}`, ownerId, {
    action: 'delete change log',
    share: shareCode,
  });
}

export async function apiDeleteChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entryId: string,
  shareCode: string | null = null,
): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/log/${entryId}`, ownerId, {
    action: 'delete change log entry',
    share: shareCode,
  });
}

// Deduped on `${ownerId}|${id}`: editor mount fires this for the
// share-dialog state alongside the other read endpoints. Strict
// Mode doubling collapses to one fetch.
// Returns the diagram's share links AND its current share password
// (spec/24) in one owner-only round-trip — the Share dialog needs both.
async function _apiListShareLinks(
  ownerId: string,
  id: string,
): Promise<{ links: ShareLink[]; password: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    headers: await apiHeaders(ownerId),
  });
  const { links, password } = await expectOk<ShareLinksResponse>(res, 'list share links');
  return { links, password: password ?? null };
}
export const apiListShareLinks = dedupeInFlight(
  _apiListShareLinks,
  (ownerId, id) => `${ownerId}|${id}`,
);

// Set (or clear, with null / empty) the diagram's share password.
// Owner-only on the api side. Returns the stored value (normalised).
export async function apiSetSharePassword(
  ownerId: string,
  id: string,
  password: string | null,
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share-password`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ password }),
  });
  const { password: stored } = await expectOk<SharePasswordResponse>(res, 'set share password');
  return stored ?? null;
}

export async function apiCreateShareLink(
  ownerId: string,
  id: string,
  role: ShareRole,
): Promise<ShareLink> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ role }),
  });
  const { link } = await expectOk<ShareLinkResponse>(res, 'create share link');
  return link;
}

export async function apiDeleteShareLink(ownerId: string, id: string, code: string): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${id}/share/${code}`, ownerId, {
    action: 'delete share link',
  });
}

// Persist diagram-level metadata: name (rename) and tab order. Used
// for tab reorders + rename ops — anything that doesn't touch
// element content. Element changes go through apiSaveTab.
export async function apiSaveDiagramMeta(
  ownerId: string,
  d: { id: string; name?: string; tabIds?: string[] },
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${d.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify({ name: d.name, tabIds: d.tabIds }),
  });
  await expectOkVoid(res, 'save diagram meta');
}

// Create a brand-new diagram with an optional initial set of tabs.
// `templateChosen` is UI-only state (have we dismissed the per-tab
// template picker yet?). It rides on the Tab type so the editor can
// flip it locally, but there's no reason for the server to persist
// it — strip before every write so it stays purely a frontend
// concern. The server-side data column simply won't carry the field
// going forward; pre-existing rows that have it become no-ops on
// load (we use it if present, drop it on next save).
function stripTemplateChosen(tab: Tab): Tab {
  if (tab.templateChosen === undefined) return tab;
  const { templateChosen: _tc, ...rest } = tab;
  void _tc;
  return rest as Tab;
}

// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDiagram(
  ownerId: string,
  d: { id: string; name: string; tabs?: Tab[] },
): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      tabs: (d.tabs ?? []).map(stripTemplateChosen),
    }),
  });
  const { diagram } = await expectOk<DiagramResponse>(res, 'create diagram');
  return diagram;
}

// Full tab payload, including elements + per-tab metadata. Pulled
// lazily when the user opens a tab; the diagram-summary fetch only
// carries TabSummary rows.
async function _apiLoadTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null,
): Promise<Tab | null> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  const body = await expectOkOrNull<TabResponse>(res, 'load tab');
  if (!body) return null;
  const { tab } = body;
  const { diagramId: _did, orderIndex: _oi, updatedAt: _ua, ...clientTab } = tab;
  void _did;
  void _oi;
  void _ua;
  return clientTab;
}
export const apiLoadTab = dedupeInFlight(
  _apiLoadTab,
  (ownerId, diagramId, tabId, shareCode) => `${ownerId}␟${diagramId}␟${tabId}␟${shareCode ?? ''}`,
);

// Upsert a single tab. The active edit path — autosave hits this
// instead of shipping every tab on every keystroke.
export async function apiSaveTab(
  ownerId: string,
  diagramId: string,
  tab: Tab,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tab.id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(stripTemplateChosen(tab)),
  });
  await expectOkVoid(res, 'save tab');
}

// Append a comment to one element's thread on a specific tab.
// View-role visitors can call this (the only write path open to
// them): owner / edit-role visitors also could but already get
// the same write via the tab autosave, so the editor only invokes
// this for view-role sessions so a viewer's contribution actually
// persists. Returns the freshly-created comment so the caller can
// merge it into local state without a tab refetch.
export async function apiAddComment(
  ownerId: string,
  diagramId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode: string | null = null,
): Promise<{
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
  authorColor: string;
}> {
  const res = await fetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/comments`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({ elementId, text }),
    },
  );
  return expectOk<{
    comment: {
      id: string;
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    };
  }>(res, 'add comment').then((b) => b.comment);
}

// Link an existing tab into another of the caller's diagrams
// (spec/17). After this returns, the tab body is shared: edits
// from either diagram write to the same `tabs.data` row. Returns
// the target diagram's summary view of the now-attached tab so
// the caller can update its TabBar without a full diagram
// refetch.
export async function apiLinkTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
): Promise<TabSummary> {
  const res = await fetch(
    `${API_BASE}/diagrams/${encodeURIComponent(diagramId)}/tabs/${encodeURIComponent(tabId)}/link`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId),
    },
  );
  return expectOk<{ tab: TabSummary }>(res, 'link tab').then((b) => b.tab);
}

export async function apiDeleteTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  return apiDelete(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, ownerId, {
    action: 'delete tab',
    share: shareCode,
  });
}

export async function apiDeleteDiagram(ownerId: string, id: string): Promise<void> {
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the Clerk Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (spec/04, spec/11).
  return apiDelete(`${API_BASE}/diagrams/${id}`, ownerId, { action: 'delete diagram' });
}

async function _apiListDiagrams(ownerId: string): Promise<DiagramSummary[]> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    headers: await apiHeaders(ownerId),
  });
  const { diagrams } = await expectOk<ListResponse>(res, 'list');
  return diagrams;
}
export const apiListDiagrams = dedupeInFlight(_apiListDiagrams, (ownerId) => ownerId);

// ---------------------------------------------------------------------
// shared_with — "Shared with you" (migration 0010)
// ---------------------------------------------------------------------

export type SharedWithItem = {
  id: string;
  name: string;
  savedAt: number;
  role: 'edit' | 'view';
  // Still-live share code for the same role the visitor was
  // granted. Client uses it to build the editor URL
  // (`/live/diagram/<id>?s=<code>`) — without it the link would
  // land on the owner-only diagram path and 404. Server-side
  // filtering drops rows whose share was revoked entirely.
  shareCode: string;
  // Owner's display name + avatar colour, joined server-side from
  // the participants table. Nullable because Clerk-authed owners
  // don't always have a participant row (they show up after their
  // first share / hello). The UI renders an "Unknown owner"
  // placeholder when null.
  ownerName: string | null;
  ownerColor: string | null;
};

// List diagrams that have been shared with this owner (i.e. the
// owner previously opened a share link for them and was identified
// to the api at the time). Returns newest-interaction-first.
// Same dedupe rationale as apiListDiagrams: editor + /new +
// /explorer all mount surfaces that fire this on first paint.
async function _apiListSharedWith(ownerId: string): Promise<SharedWithItem[]> {
  const res = await fetch(`${API_BASE}/shared`, { headers: await apiHeaders(ownerId) });
  const { shared } = await expectOk<{ shared: SharedWithItem[] }>(res, 'list shared');
  return shared;
}
export const apiListSharedWith = dedupeInFlight(_apiListSharedWith, (ownerId) => ownerId);

// Dismiss a single "shared with you" row.
export async function apiDismissSharedWith(ownerId: string, diagramId: string): Promise<void> {
  return apiDelete(`${API_BASE}/shared/${diagramId}`, ownerId, {
    action: 'dismiss shared',
    allow404: false,
  });
}

// Copy a diagram (typically one shared with the caller) into the
// caller's own files. Returns the new diagram. Optional shareCode
// covers the "visitor just arrived via share URL, no shared_with
// row yet" path — when present the api worker uses it as the
// authorisation proof instead of looking up shared_with.
export async function apiCopyDiagram(
  ownerId: string,
  sourceId: string,
  opts: { name?: string; shareCode?: string | null } = {},
): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams/${sourceId}/copy`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true, share: opts.shareCode ?? null }),
    body: JSON.stringify({ name: opts.name }),
  });
  const { diagram } = await expectOk<DiagramResponse>(res, 'copy diagram');
  return diagram;
}

// ---------------------------------------------------------------------
// folders — spec/15
// ---------------------------------------------------------------------

// Same dedupe rationale as apiListDiagrams. useFolders runs once
// per page surface; concurrent mounts on multi-panel pages (e.g.
// /new shows the floating Explorer AND the welcome flow, both
// gated on the same ownerId) would otherwise fire duplicate
// GET /folders calls.
async function _apiListFolders(ownerId: string): Promise<Folder[]> {
  const res = await fetch(`${API_BASE}/folders`, { headers: await apiHeaders(ownerId) });
  const { folders } = await expectOk<FoldersResponse>(res, 'list folders');
  return folders;
}
export const apiListFolders = dedupeInFlight(_apiListFolders, (ownerId) => ownerId);

export async function apiCreateFolder(
  ownerId: string,
  input: { id: string; name: string; parentId?: string | null },
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      parentId: input.parentId ?? null,
    }),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'create folder');
  return folder;
}

export async function apiUpdateFolder(
  ownerId: string,
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'update folder');
  return folder;
}

export async function apiDeleteFolder(ownerId: string, id: string): Promise<void> {
  return apiDelete(`${API_BASE}/folders/${id}`, ownerId, { action: 'delete folder' });
}

export async function apiSetDiagramFolder(
  ownerId: string,
  diagramId: string,
  folderId: string | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/folder`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ folderId }),
  });
  await expectOkVoid(res, 'set folder');
}

// Deduped by id: the editor's hydration effect AND /live/new's
// initial fetch both call this on first paint; React Strict Mode
// in dev doubles each. With dedup, all four collapse to one fetch
// when they land in the same tick.
async function _apiLoadSelf(id: string): Promise<Participant | null> {
  const res = await fetch(`${API_BASE}/participants/${id}`);
  const body = await expectOkOrNull<ParticipantResponse>(res, 'load self');
  if (!body) return null;
  const { participant } = body;
  return {
    id: participant.id,
    name: participant.name,
    color: participant.color,
    status: 'online',
  };
}
export const apiLoadSelf = dedupeInFlight(_apiLoadSelf, (id) => id);

// Account self-deletion (Clerk-only). Wipes the caller's diagrams,
// folders, and participant row server-side; the caller is expected
// to follow up with Clerk's `user.delete()` to drop the Clerk
// account itself. Order matters — backend first, then Clerk — so a
// Clerk-side failure doesn't leave the user without an account but
// with orphaned data. Returns the change counts on success or null
// on any non-2xx so the caller can decide whether to proceed with
// the Clerk delete.
export async function apiDeleteAccount(): Promise<{
  diagrams: number;
  folders: number;
} | null> {
  // ownerId arg is unused server-side for this endpoint (the
  // resolved Clerk id wins), but apiHeaders' signature wants
  // something — pass an empty string. The registered token
  // provider attaches the Bearer; the endpoint refuses if absent.
  const res = await fetch(`${API_BASE}/account`, {
    method: 'DELETE',
    headers: await apiHeaders(''),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { deleted: { diagrams: number; folders: number } };
  return body.deleted;
}

// Guest → authed ownership migration. Called once on first sign-in
// from editor-page.tsx + new/page.tsx when both conditions hold:
//   - the Clerk session is active (a Bearer token will be sent)
//   - `livediagram:v2:self-id` is still in localStorage
// On success the caller clears the localStorage id so subsequent
// loads use only the Clerk userId.
//
// The api worker (`POST /api/migrate` in `apps/api/src/index.ts`)
// requires a verified Bearer token: there is no `X-Owner-Id`
// fallback, because the whole point is to bind orphan guest data
// to a Clerk account. Returns
// `{ migrated: { diagrams, folders, shared, images } }`.
export async function apiMigrateGuestData(
  guestOwnerId: string,
): Promise<{ diagrams: number; folders: number; shared: number; images: number } | null> {
  const res = await fetch(`${API_BASE}/migrate`, {
    method: 'POST',
    // `apiHeaders` reads the registered token provider; the Clerk
    // Bearer will be on every call from the editor / new-diagram
    // pages after they've set the provider. ownerId is unused
    // server-side for this endpoint but the helper still expects
    // it; pass the guest id to keep signatures uniform.
    headers: await apiHeaders(guestOwnerId, { body: true }),
    body: JSON.stringify({ guestOwnerId }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    migrated: { diagrams: number; folders: number; shared: number; images: number };
  };
  return body.migrated;
}

export async function apiSaveSelf(p: Participant): Promise<void> {
  // Owner-gated server-side as of the participants-PUT security fix.
  // The api worker requires the caller's resolved owner to match the
  // participant id being mutated — for both modes that's the same
  // value as `p.id` (a guest's localStorage UUID is also their
  // X-Owner-Id; a signed-in user's Clerk userId is also their
  // participant id, see editor-page.tsx identity bootstrap).
  const res = await fetch(`${API_BASE}/participants/${p.id}`, {
    method: 'PUT',
    headers: await apiHeaders(p.id, { body: true }),
    body: JSON.stringify({ name: p.name, color: p.color }),
  });
  await expectOkVoid(res, 'save self');
}

// ---------------------------------------------------------------------
// Realtime room
// ---------------------------------------------------------------------
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livediagram/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// below is the client-side callback shape only — not on the wire —
// so it stays here next to the connect helper.

export type RoomHandlers = {
  onPresence: (
    participants: {
      id: string;
      name: string;
      color: string;
      role?: 'edit' | 'view';
    }[],
  ) => void;
  onOp: (from: string, op: RoomOp) => void;
  onClose?: () => void;
};

export function connectRoom(
  diagramId: string,
  participant: { id: string; name: string; color: string },
  handlers: RoomHandlers,
  options: { shareCode?: string | null; ownerId?: string | null } = {},
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
} {
  // Browsers can't set custom headers on a WebSocket upgrade, so the
  // share code (and owner id, for diagrams the visitor owns) ride on
  // the query string. The api worker reads them, resolves role, and
  // forwards an X-Verified-Role header to the Durable Object before
  // the upgrade reaches it. Empty / missing values are stripped so
  // the URL stays clean.
  const params = new URLSearchParams();
  if (options.shareCode) params.set('s', options.shareCode);
  if (options.ownerId) params.set('o', options.ownerId);
  // Share password (spec/24) for a protected diagram's room. The api
  // refuses the upgrade if it's missing / wrong. Read from the same
  // session state apiHeaders uses, so the editor doesn't have to thread
  // it through; owners never have it set so their `o` upgrade bypasses.
  if (sessionSharePassword) params.set('p', sessionSharePassword);
  const qs = params.toString();
  const ws = new WebSocket(wsUrl(`/diagrams/${diagramId}/ws${qs ? `?${qs}` : ''}`));
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ kind: 'hello', participant } satisfies RoomOutgoing));
  });
  ws.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data) as RoomIncoming;
      if (msg.kind === 'presence') handlers.onPresence(msg.participants);
      else if (msg.kind === 'op') handlers.onOp(msg.from, msg.op);
    } catch {
      // Malformed frame — ignore. Production would log here.
    }
  });
  ws.addEventListener('close', () => handlers.onClose?.());
  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
}

// --- Images (spec/19) ----------------------------------------------------

// Listing the owner's gallery. Returns null when the server reports
// 503 (R2 not provisioned on this deployment), letting the picker
// hide the gallery tab + the palette hide its Image entry without
// throwing through an error boundary. Other failures still throw.
//
// Deduped: when the editor mounts, both the Current Tab "Images"
// accordion and the lazy ImagePicker (if the user opens it
// immediately) fire this. React Strict Mode in dev doubles every
// effect on top. Without dedup that's 2 to 4 concurrent fetches
// for the same gallery; with it, the second+ callers receive the
// in-flight promise the first one started.
async function _apiListImages(ownerId: string): Promise<ImageSummary[] | null> {
  const res = await fetch(`${API_BASE}/images`, {
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 503) return null;
  return expectOk<{ images: ImageSummary[] }>(res, 'list images').then((b) => b.images);
}
export const apiListImages = dedupeInFlight(_apiListImages, (ownerId) => ownerId);

// Upload bytes + index in the gallery. `sha256` and dimensions are
// computed client-side (the picker reads the file into an
// ArrayBuffer, calls crypto.subtle.digest, and decodes width/height
// via a transient <img>); the server independently re-verifies the
// SHA so a forged header can't poison the dedupe key. Returns the
// dedupe flag so the picker can flash "Already in your gallery"
// when the bytes had been uploaded before.
export async function apiUploadImage(
  ownerId: string,
  file: {
    bytes: ArrayBuffer;
    contentType: string;
    sha256: string;
    width: number;
    height: number;
    originalName?: string;
  },
): Promise<{ image: ImageSummary; deduped: boolean }> {
  const headers = new Headers(await apiHeaders(ownerId));
  headers.set('Content-Type', file.contentType);
  headers.set('Content-Length', String(file.bytes.byteLength));
  headers.set('X-Image-Sha256', file.sha256);
  headers.set('X-Image-Width', String(file.width));
  headers.set('X-Image-Height', String(file.height));
  if (file.originalName) headers.set('X-Image-Original-Name', file.originalName);
  const res = await fetch(`${API_BASE}/images`, {
    method: 'POST',
    headers,
    body: file.bytes,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`upload image failed: ${res.status} ${body.error ?? ''}`.trim());
  }
  return res.json() as Promise<{ image: ImageSummary; deduped: boolean }>;
}

export async function apiDeleteImage(ownerId: string, imageId: string): Promise<void> {
  return apiDelete(`${API_BASE}/images/${encodeURIComponent(imageId)}`, ownerId, {
    action: 'delete image',
    allow404: false,
  });
}

// Inverse-index of which diagrams reference each owned image.
// Backs the Explorer Image Gallery's "Used in" badge. Images that
// aren't placed on any canvas yet are absent from the map (treat a
// missing key as "0 uses, safe to delete"). 503 collapses to an
// empty map so a self-host without R2 still renders an empty
// gallery rather than a hard error.
//
// Deduped alongside apiListImages: the GalleryPane fires both in a
// Promise.all on mount, and React Strict Mode doubles the effect.
// The endpoint does a full join + JSON parse per call on the
// server, so squashing concurrent identical fetches matters even
// more than for the cheap list endpoint.
async function _apiImageUsage(
  ownerId: string,
): Promise<Record<string, { id: string; name: string }[]>> {
  const res = await fetch(`${API_BASE}/images/usage`, {
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 503) return {};
  return expectOk<{ usage: Record<string, { id: string; name: string }[]> }>(
    res,
    'image usage',
  ).then((b) => b.usage);
}
export const apiImageUsage = dedupeInFlight(_apiImageUsage, (ownerId) => ownerId);

// --- User preferences (spec/20) -----------------------------------------
//
// Per-user editor preference flags persisted server-side so a signed-
// in user's choices follow them across devices. Guests get a copy
// keyed by their X-Owner-Id, so a localStorage clear still recovers
// the flags as long as the same browser participant id is in play.
//
// The shape is opaque to the api-client by design: spec/20's
// UserPreferences lives in apps/live/lib/user-preferences.ts as the
// authoritative type, and we marshal it as a plain Record so adding
// a flag never needs an api-schema change.

export async function apiGetPreferences(ownerId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/preferences`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { prefs?: unknown };
    if (!body.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) return null;
    return body.prefs as Record<string, unknown>;
  } catch {
    // Network failure (offline, api worker unreachable in a pure-
    // guest self-host without /api configured) returns null. The
    // caller falls back to the localStorage cache, matching the
    // pre-D1 behaviour exactly.
    return null;
  }
}

export async function apiPutPreferences(
  ownerId: string,
  prefs: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/preferences`, {
      method: 'PUT',
      headers: await apiHeaders(ownerId, { body: true }),
      body: JSON.stringify({ prefs }),
    });
    // Errors swallowed: the toggle has already taken effect locally
    // and we don't surface a toast for a settings-sync failure
    // (would be more annoying than useful). Next page load reads
    // localStorage, which is the authoritative value for this
    // device until the next successful PUT.
  } catch {
    // Same swallow as above.
  }
}

// Fetch the bytes of one image (authenticated) and return a blob
// URL the caller can stick on an `<img>`. The caller is responsible
// for revoking the URL when the element unmounts to prevent leaks.
// Native `<img>` can't send auth headers, so the fetch-then-blob
// dance is the way every read gets owner / share auth without
// exposing the bytes publicly. Returns null on 404 / 403 / 503 so
// the renderer can show a broken-image placeholder.
export async function apiFetchImageBlobUrl(
  ownerId: string,
  imageId: string,
  opts: { diagramId?: string; shareCode?: string | null } = {},
): Promise<string | null> {
  const params = new URLSearchParams();
  if (opts.diagramId) params.set('d', opts.diagramId);
  const url = `${API_BASE}/images/${encodeURIComponent(imageId)}${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  const headers = new Headers(await apiHeaders(ownerId, { share: opts.shareCode ?? null }));
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------
// AI Assistance (spec/25)
// ---------------------------------------------------------------------

// Fetch server capabilities once at editor mount. Returns
// { aiEnabled: false } on any network error so callers can fail-closed.
export async function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  try {
    const res = await fetch(`${API_BASE}/capabilities`);
    if (!res.ok) return { aiEnabled: false };
    return (await res.json()) as CapabilitiesResponse;
  } catch {
    return { aiEnabled: false };
  }
}

// Valid shape kinds — must stay in sync with packages/diagram ShapeKind.
// Used to validate AI-returned elements before applying them.
const VALID_SHAPE_KINDS = new Set([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'stadium',
  'actor',
  'cloud',
  'browser',
  'monitor',
  'laptop',
  'phone',
  'tablet',
]);

function isValidElement(el: unknown): el is Element {
  if (typeof el !== 'object' || el === null) return false;
  const obj = el as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  const t = obj.type;
  if (t === 'shape') {
    return (
      VALID_SHAPE_KINDS.has(obj.shape as string) &&
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.width === 'number' &&
      (obj.width as number) > 0 &&
      typeof obj.height === 'number' &&
      (obj.height as number) > 0
    );
  }
  if (t === 'text' || t === 'sticky') {
    return (
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.width === 'number' &&
      typeof obj.height === 'number'
    );
  }
  if (t === 'arrow') {
    return typeof obj.from === 'object' && typeof obj.to === 'object';
  }
  return false;
}

// Parse all complete element objects out of an accumulated JSON buffer.
// Finds the "elements":[ array, then extracts each top-level {...} object
// as soon as brace depth returns to zero. Called after each SSE chunk so
// new elements are surfaced incrementally while the stream is live.
function extractElementsFromBuffer(buffer: string): Element[] {
  const match = buffer.match(/"elements"\s*:\s*\[/);
  if (!match || match.index === undefined) return [];
  const elements: Element[] = [];
  let depth = 0;
  let start = -1;
  for (let i = match.index + match[0].length; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const el = JSON.parse(buffer.slice(start, i + 1));
          if (isValidElement(el)) elements.push(el);
        } catch {
          /* skip malformed */
        }
        start = -1;
      }
    }
  }
  return elements;
}

// Unified streaming handler for all AI modes. All modes now stream from
// the server (OpenAI SSE piped through the worker).
//
// For review: onTextChunk fires with each incremental text fragment.
// For mutating modes: onProgress fires as elements are parsed out of
// the streaming JSON (useful for showing a live count). onDone fires
// once with the final validated element array.
//
// Throws on network error, non-2xx, or off-topic refusal.
export async function apiAiStream(
  ownerId: string,
  payload: AiRequest,
  callbacks: {
    onTextChunk?: (text: string) => void;
    onProgress?: (count: number) => void;
    onDone: (result: {
      elements: Element[];
      offTopic: boolean;
      reviewText: string;
      summary: string;
    }) => void;
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/ai`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`ai request failed: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onDone({ elements: [], offTopic: false, reviewText: '', summary: '' });
    return;
  }

  const decoder = new TextDecoder();
  let buf = '';
  let jsonBuf = ''; // accumulated JSON tokens for mutating modes
  let reviewText = '';
  let lastCount = 0;
  const isReview = payload.mode === 'review' || payload.mode === 'ask';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (!text) continue;
        if (isReview) {
          reviewText += text;
          callbacks.onTextChunk?.(text);
        } else {
          jsonBuf += text;
          const elements = extractElementsFromBuffer(jsonBuf);
          if (elements.length > lastCount) {
            lastCount = elements.length;
            callbacks.onProgress?.(lastCount);
          }
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }

  if (isReview) {
    callbacks.onDone({ elements: [], offTopic: false, reviewText, summary: '' });
    return;
  }

  const offTopic = /"offTopic"\s*:\s*true/.test(jsonBuf);
  if (offTopic) throw new Error('off_topic');
  // Final parse — use the fully accumulated buffer for the authoritative list.
  const elements = extractElementsFromBuffer(jsonBuf);
  // Extract the optional summary field the model includes alongside elements.
  let summary = '';
  try {
    const summaryMatch = jsonBuf.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (summaryMatch) summary = summaryMatch[1]!.replace(/\\n/g, ' ').replace(/\\"/g, '"');
  } catch {
    /* no summary */
  }
  callbacks.onDone({ elements, offTopic: false, reviewText: '', summary });
}

// Re-export types so callers don't need extra imports.
export type { AiMode, AiConversationTurn };
