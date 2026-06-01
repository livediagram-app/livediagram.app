import type {
  ChangeLogEntry,
  ChangeLogKind,
  Diagram,
  DiagramSummary,
  Folder,
  RoomIncoming,
  RoomOp,
  RoomOutgoing,
  ShareLink,
  ShareRole,
  TabRecord,
  TabSummary,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/diagram';
import type { Participant } from './identity';

// Re-export the wire-format types under the names the live app has
// historically used so callers (editor-page.tsx, new/page.tsx, etc.)
// keep their existing imports. The canonical definitions live in
// `@livediagram/api-schema` — see that package's index.ts for the
// shapes and per-type rationale.
export type {
  ChangeLogEntry,
  ChangeLogKind,
  DiagramSummary,
  Folder,
  RoomIncoming,
  RoomOp,
  RoomOutgoing,
  ShareLink,
  ShareRole,
  TabSummary,
};

// Historical alias the live app uses for the "diagram + tab
// summaries" payload. The wider canonical shape now includes
// `createdAt`, which the live app simply doesn't read today — the
// extra field costs nothing and unblocks future "created on X" UI.
export type StoredDiagram = Diagram;

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

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
type ShareResponse = { shareable: boolean; shareCode: string | null };
type ShareLinkResponse = { link: ShareLink };
type ShareLinksResponse = { links: ShareLink[] };
type ChangeLogListResponse = { entries: ChangeLogEntry[] };
type ChangeLogAppendResponse = { entry: ChangeLogEntry };
type ParticipantResponse = {
  participant: { id: string; name: string; color: string; createdAt: number };
};

type SharedDiagramResolution = {
  diagram: StoredDiagram;
  role: ShareRole;
};

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

async function apiHeaders(
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

// Collapse concurrent identical calls into a single in-flight
// promise. The wrapped function keeps its original signature; the
// `keyOf` function derives a string identity from its arguments
// so different argument shapes don't share entries (e.g. one
// ownerId never blocks a different ownerId's request).
//
// Why this exists: React Strict Mode dev double-invokes effects,
// and the editor / new / explorer routes each mount surfaces that
// kick off the same list / load endpoints on first paint. Without
// dedup a signed-in user opening a route produces 2 to 6
// concurrent fetches for the same data. With it, the second + nth
// callers receive the in-flight promise the first one started,
// and the entry self-cleans in a finally so the next round-trip
// is fresh.
//
// Only safe for endpoints whose response is purely a function of
// the arguments (idempotent GETs). Writes / mutations stay
// un-deduped to keep their semantics obvious.
function dedupeInFlight<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyOf: (...args: TArgs) => string,
): (...args: TArgs) => Promise<TResult> {
  const inFlight = new Map<string, Promise<TResult>>();
  return (...args: TArgs): Promise<TResult> => {
    const key = keyOf(...args);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = (async (): Promise<TResult> => {
      try {
        return await fn(...args);
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, request);
    return request;
  };
}

export async function apiLoadDiagram(ownerId: string, id: string): Promise<StoredDiagram | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<DiagramResponse>(res, 'load');
  return body?.diagram ?? null;
}

// Resolve a share code to a full diagram + the role granted by that
// code. Visitors landing on `/live/diagram/shared?s=<code>` use
// this; revoked codes return 404 from the API.
export async function apiLoadShared(code: string): Promise<SharedDiagramResolution | null> {
  const res = await fetch(`${API_BASE}/share/${code}`);
  const body = await expectOkOrNull<DiagramResponse & { role?: ShareRole }>(res, 'load shared');
  if (!body) return null;
  return {
    diagram: body.diagram,
    role: body.role === 'view' ? 'view' : 'edit',
  };
}

// ---------------------------------------------------------------------
// Change log (per-diagram audit) — see specs/12-activity-and-audit.md
// ---------------------------------------------------------------------

export async function apiListChangeLog(
  ownerId: string,
  id: string,
  shareCode: string | null = null,
): Promise<ChangeLogEntry[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/log`, {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  const { entries } = await expectOk<ChangeLogListResponse>(res, 'list change log');
  return entries;
}

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
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log/tab/${tabId}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  await expectOkOr404Void(res, 'delete change log');
}

export async function apiDeleteChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entryId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log/${entryId}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  await expectOkOr404Void(res, 'delete change log entry');
}

export async function apiListShareLinks(ownerId: string, id: string): Promise<ShareLink[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    headers: await apiHeaders(ownerId),
  });
  const { links } = await expectOk<ShareLinksResponse>(res, 'list share links');
  return links;
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
  const res = await fetch(`${API_BASE}/diagrams/${id}/share/${code}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  await expectOkOr404Void(res, 'delete share link');
}

export async function apiShareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
  });
  return expectOk<ShareResponse>(res, 'share');
}

export async function apiUnshareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, { body: true }),
  });
  return expectOk<ShareResponse>(res, 'unshare');
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
): Promise<StoredDiagram> {
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

export async function apiDeleteTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  await expectOkOr404Void(res, 'delete tab');
}

export async function apiDeleteDiagram(ownerId: string, id: string): Promise<void> {
  // Owner-gated server-side as of the security fix — without the
  // identity headers the worker would 400 / 403. apiHeaders prefers
  // the Clerk Bearer when a token provider is registered, falls
  // through to X-Owner-Id otherwise (spec/04, spec/11).
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  await expectOkOr404Void(res, 'delete diagram');
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
  const res = await fetch(`${API_BASE}/shared/${diagramId}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  await expectOkVoid(res, 'dismiss shared');
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
): Promise<StoredDiagram> {
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
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  await expectOkOr404Void(res, 'delete folder');
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

export async function apiLoadSelf(id: string): Promise<Participant | null> {
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
// requires a verified Bearer token — there is no `X-Owner-Id`
// fallback, because the whole point is to bind orphan guest data
// to a Clerk account. Returns `{ migrated: { diagrams, folders } }`.
export async function apiMigrateGuestData(
  guestOwnerId: string,
): Promise<{ diagrams: number; folders: number } | null> {
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
  const body = (await res.json()) as { migrated: { diagrams: number; folders: number } };
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
  onPresence: (participants: { id: string; name: string; color: string }[]) => void;
  onOp: (from: string, op: RoomOp) => void;
  onClose?: () => void;
};

export function connectRoom(
  diagramId: string,
  participant: { id: string; name: string; color: string },
  handlers: RoomHandlers,
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
} {
  const ws = new WebSocket(wsUrl(`/diagrams/${diagramId}/ws`));
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
