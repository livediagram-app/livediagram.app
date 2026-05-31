import type {
  ChangeLogEntry,
  ChangeLogKind,
  Diagram,
  DiagramSummary,
  Folder,
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

export type SharedDiagramResolution = {
  diagram: StoredDiagram;
  role: ShareRole;
};

// Owner identity is always carried via `X-Owner-Id`. Visitors on a
// share URL include their own participant id there PLUS the share
// code that admitted them in `X-Share-Code` — the API checks the
// code's role before allowing the write. Owners pass `share: null`
// (the default) and the share-code header is omitted.
//
// `body: true` adds `Content-Type: application/json` for write
// requests; GETs / DELETEs omit it. One helper instead of three
// near-identical ones, with intent at the call site spelled out
// by the option flags.
function apiHeaders(
  ownerId: string,
  opts: { share?: string | null; body?: boolean } = {},
): HeadersInit {
  const h: Record<string, string> = { 'X-Owner-Id': ownerId };
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

export async function apiLoadDiagram(ownerId: string, id: string): Promise<StoredDiagram | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    headers: apiHeaders(ownerId),
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
    headers: apiHeaders(ownerId, { share: shareCode }),
  });
  const { entries } = await expectOk<ChangeLogListResponse>(res, 'list change log');
  return entries;
}

export async function apiAppendChangeLogEntry(
  ownerId: string,
  entry: Omit<ChangeLogEntry, 'diagramId'> & { diagramId: string },
  shareCode: string | null = null,
): Promise<ChangeLogEntry> {
  const res = await fetch(`${API_BASE}/diagrams/${entry.diagramId}/log`, {
    method: 'POST',
    headers: apiHeaders(ownerId, { share: shareCode, body: true }),
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
    headers: apiHeaders(ownerId, { share: shareCode }),
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
    headers: apiHeaders(ownerId, { share: shareCode }),
  });
  await expectOkOr404Void(res, 'delete change log entry');
}

export async function apiListShareLinks(ownerId: string, id: string): Promise<ShareLink[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    headers: apiHeaders(ownerId),
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
    headers: apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ role }),
  });
  const { link } = await expectOk<ShareLinkResponse>(res, 'create share link');
  return link;
}

export async function apiDeleteShareLink(ownerId: string, id: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share/${code}`, {
    method: 'DELETE',
    headers: apiHeaders(ownerId),
  });
  await expectOkOr404Void(res, 'delete share link');
}

export async function apiShareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: apiHeaders(ownerId, { body: true }),
  });
  return expectOk<ShareResponse>(res, 'share');
}

export async function apiUnshareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'DELETE',
    headers: apiHeaders(ownerId, { body: true }),
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
    headers: apiHeaders(ownerId, { share: shareCode, body: true }),
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
    headers: apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: d.id,
      name: d.name,
      tabs: (d.tabs ?? []).map(stripTemplateChosen),
    }),
  });
  const { diagram } = await expectOk<DiagramResponse>(res, 'create diagram');
  return diagram;
}

// In-flight tab loads, keyed by ownerId+diagramId+tabId+shareCode.
// StrictMode double-invokes the lazy-load effect in dev, which
// otherwise produces a duplicate GET for the same tab on every
// mount. Returning the shared promise collapses the duplicates
// into a single network request without changing the calling
// shape.
const inFlightTabLoads = new Map<string, Promise<Tab | null>>();

// Full tab payload, including elements + per-tab metadata. Pulled
// lazily when the user opens a tab; the diagram-summary fetch only
// carries TabSummary rows.
export function apiLoadTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<Tab | null> {
  const key = `${ownerId}␟${diagramId}␟${tabId}␟${shareCode ?? ''}`;
  const existing = inFlightTabLoads.get(key);
  if (existing) return existing;
  const request = (async (): Promise<Tab | null> => {
    try {
      const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
        headers: apiHeaders(ownerId, { share: shareCode }),
      });
      const body = await expectOkOrNull<TabResponse>(res, 'load tab');
      if (!body) return null;
      const { tab } = body;
      const { diagramId: _did, orderIndex: _oi, updatedAt: _ua, ...clientTab } = tab;
      void _did;
      void _oi;
      void _ua;
      return clientTab;
    } finally {
      inFlightTabLoads.delete(key);
    }
  })();
  inFlightTabLoads.set(key, request);
  return request;
}

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
    headers: apiHeaders(ownerId, { share: shareCode, body: true }),
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
    headers: apiHeaders(ownerId, { share: shareCode }),
  });
  await expectOkOr404Void(res, 'delete tab');
}

export async function apiDeleteDiagram(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, { method: 'DELETE' });
  await expectOkOr404Void(res, 'delete diagram');
}

export async function apiListDiagrams(ownerId: string): Promise<DiagramSummary[]> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    headers: apiHeaders(ownerId),
  });
  const { diagrams } = await expectOk<ListResponse>(res, 'list');
  return diagrams;
}

// ---------------------------------------------------------------------
// folders — spec/15
// ---------------------------------------------------------------------

export async function apiListFolders(ownerId: string): Promise<Folder[]> {
  const res = await fetch(`${API_BASE}/folders`, { headers: apiHeaders(ownerId) });
  const { folders } = await expectOk<FoldersResponse>(res, 'list folders');
  return folders;
}

export async function apiCreateFolder(
  ownerId: string,
  input: { id: string; name: string; parentId?: string | null },
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: apiHeaders(ownerId, { body: true }),
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
    headers: apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { folder } = await expectOk<FolderResponse>(res, 'update folder');
  return folder;
}

export async function apiDeleteFolder(ownerId: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
    headers: apiHeaders(ownerId),
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
    headers: apiHeaders(ownerId, { body: true }),
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

export async function apiSaveSelf(p: Participant): Promise<void> {
  const res = await fetch(`${API_BASE}/participants/${p.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: p.name, color: p.color }),
  });
  await expectOkVoid(res, 'save self');
}

// ---------------------------------------------------------------------
// Realtime room
// ---------------------------------------------------------------------

// All op kinds the client sends / receives. Keep the room itself
// agnostic of these — it just rebroadcasts. New op shapes only need
// to grow this union and matching handlers in page.tsx.
export type RoomOp =
  // A new audit-log entry just landed. Used to mirror activity into
  // every connected client's panel without a round-trip through D1.
  // The owner of the diagram is the persistent writer; everyone else
  // updates their local list when this op arrives.
  | { kind: 'log'; entry: ChangeLogEntry }
  // The named log entry was removed (e.g. via Undo or Revert). Other
  // clients drop it from their local list so the panel stays in sync.
  | { kind: 'log-remove'; entryId: string }
  // The sender just switched to (or initially focused) a tab.
  // Drives the per-tab avatar dots in the TabBar so collaborators
  // can see at a glance which tab each peer is working on.
  | { kind: 'tab-focus'; tabId: string }
  // A single tab's content changed. The post-refactor replacement
  // for the heavyweight `tabs` op below — sender ships only the
  // one tab they edited. Receivers merge by id.
  | { kind: 'tab'; tabId: string; tab: Tab }
  // Diagram-level metadata changed: rename, tab reorder, tab add /
  // delete. Carries the new ordered list of tab summaries (id + name
  // + order) so receivers can update the TabBar without fetching the
  // full tab payloads.
  | {
      kind: 'diagram-meta';
      name: string;
      tabs: { id: string; name: string; orderIndex: number }[];
    }
  | { kind: 'select'; elementId: string | null }
  // Cursor position in canvas coordinates. `null` means the cursor
  // left the canvas surface so peers can hide their indicator. The
  // active tab id is included so we only render cursors of
  // participants who are looking at the same tab as us.
  | { kind: 'cursor'; tabId: string; x: number | null; y: number | null }
  // One sample of the sender's laser-pointer trail (canvas-coords).
  // Sent on every pointer move while the sender is in laser tool
  // mode, throttled like cursor. Receivers append to a per-
  // participant buffer and fade the trail out over ~1 s — see
  // LaserOverlay. The active tab id scopes the rendering so peers on
  // a different tab don't see the laser.
  | { kind: 'laser'; tabId: string; x: number; y: number };

// Outgoing payloads sent from this client.
export type RoomOutgoing =
  | { kind: 'hello'; participant: { id: string; name: string; color: string } }
  | { kind: 'op'; op: RoomOp };

// Incoming payloads from the room (broadcast by the Durable Object).
export type RoomIncoming =
  | {
      kind: 'presence';
      participants: { id: string; name: string; color: string }[];
    }
  | { kind: 'op'; from: string; op: RoomOp };

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
