import type { Tab } from '@livediagram/diagram';
import type { Participant } from './identity';

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

// What the API ships when the live app loads a diagram: meta + an
// ordered list of TabSummary objects (id + name + position). Element
// content lives in TabDTO; fetched per-tab via apiLoadTab.
export type TabSummary = {
  id: string;
  diagramId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
};

export type StoredDiagram = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummary[];
  shareable: boolean;
  shareCode: string | null;
  savedAt: number;
};

export type DiagramSummary = {
  id: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  savedAt: number;
};

type DiagramResponse = {
  diagram: {
    id: string;
    ownerId: string;
    name: string;
    tabs: TabSummary[];
    shareable: boolean;
    shareCode: string | null;
    savedAt: number;
    createdAt: number;
  };
};

type TabResponse = {
  tab: Tab & {
    diagramId: string;
    orderIndex: number;
    updatedAt: number;
  };
};

type ListResponse = {
  diagrams: {
    id: string;
    name: string;
    shareable: boolean;
    shareCode: string | null;
    savedAt: number;
  }[];
};

type ShareResponse = { shareable: boolean; shareCode: string | null };

export type ShareRole = 'edit' | 'view';

export type ShareLink = {
  code: string;
  diagramId: string;
  role: ShareRole;
  createdAt: number;
};

type ShareLinkResponse = { link: ShareLink };
type ShareLinksResponse = { links: ShareLink[] };

// One row of the audit log — see specs/12-activity-and-audit.md.
// `beforeState[id] === null` ⇒ element didn't exist before (an add).
// `afterState[id]  === null` ⇒ element doesn't exist after (a delete).
export type ChangeLogKind = 'add' | 'edit' | 'delete' | 'revert';

export type ChangeLogEntry = {
  id: string;
  diagramId: string;
  tabId: string | null;
  participantId: string;
  participantName: string;
  participantColor: string;
  kind: ChangeLogKind;
  summary: string;
  elementIds: string[];
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  createdAt: number;
};

type ChangeLogListResponse = { entries: ChangeLogEntry[] };
type ChangeLogAppendResponse = { entry: ChangeLogEntry };

export type SharedDiagramResolution = {
  diagram: StoredDiagram;
  role: ShareRole;
};

type ParticipantResponse = {
  participant: {
    id: string;
    name: string;
    color: string;
    createdAt: number;
  };
};

function ownerHeaders(ownerId: string): HeadersInit {
  return { 'X-Owner-Id': ownerId, 'Content-Type': 'application/json' };
}

// Visitors on a share URL authorise by the same `X-Owner-Id` (their
// own participant id) PLUS the share code that admitted them. The
// API checks the code grants an edit-role share link before allowing
// the write. Owners pass `null` and the share-code header is omitted.
function logAuthHeaders(ownerId: string, shareCode: string | null): HeadersInit {
  const base: Record<string, string> = {
    'X-Owner-Id': ownerId,
    'Content-Type': 'application/json',
  };
  if (shareCode) base['X-Share-Code'] = shareCode;
  return base;
}

function logAuthGetHeaders(ownerId: string, shareCode: string | null): HeadersInit {
  const base: Record<string, string> = { 'X-Owner-Id': ownerId };
  if (shareCode) base['X-Share-Code'] = shareCode;
  return base;
}

export async function apiLoadDiagram(ownerId: string, id: string): Promise<StoredDiagram | null> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    headers: { 'X-Owner-Id': ownerId },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const { diagram } = (await res.json()) as DiagramResponse;
  return {
    id: diagram.id,
    ownerId: diagram.ownerId,
    name: diagram.name,
    tabs: diagram.tabs,
    shareable: diagram.shareable,
    shareCode: diagram.shareCode,
    savedAt: diagram.savedAt,
  };
}

// Resolve a share code to a full diagram + the role granted by that
// code. Visitors landing on `/live?s=<code>` use this; revoked codes
// return 404 from the API.
export async function apiLoadShared(code: string): Promise<SharedDiagramResolution | null> {
  const res = await fetch(`${API_BASE}/share/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load shared failed: ${res.status}`);
  const body = (await res.json()) as DiagramResponse & { role?: ShareRole };
  const { diagram } = body;
  return {
    diagram: {
      id: diagram.id,
      ownerId: diagram.ownerId,
      name: diagram.name,
      tabs: diagram.tabs,
      shareable: diagram.shareable,
      shareCode: diagram.shareCode,
      savedAt: diagram.savedAt,
    },
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
    headers: logAuthGetHeaders(ownerId, shareCode),
  });
  if (!res.ok) throw new Error(`list change log failed: ${res.status}`);
  const { entries } = (await res.json()) as ChangeLogListResponse;
  return entries;
}

export async function apiAppendChangeLogEntry(
  ownerId: string,
  entry: Omit<ChangeLogEntry, 'diagramId'> & { diagramId: string },
  shareCode: string | null = null,
): Promise<ChangeLogEntry> {
  const res = await fetch(`${API_BASE}/diagrams/${entry.diagramId}/log`, {
    method: 'POST',
    headers: logAuthHeaders(ownerId, shareCode),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`append change log failed: ${res.status}`);
  const { entry: stored } = (await res.json()) as ChangeLogAppendResponse;
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
    headers: logAuthGetHeaders(ownerId, shareCode),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete change log failed: ${res.status}`);
  }
}

export async function apiDeleteChangeLogEntry(
  ownerId: string,
  diagramId: string,
  entryId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log/${entryId}`, {
    method: 'DELETE',
    headers: logAuthGetHeaders(ownerId, shareCode),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete change log entry failed: ${res.status}`);
  }
}

export async function apiListShareLinks(ownerId: string, id: string): Promise<ShareLink[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    headers: { 'X-Owner-Id': ownerId },
  });
  if (!res.ok) throw new Error(`list share links failed: ${res.status}`);
  const { links } = (await res.json()) as ShareLinksResponse;
  return links;
}

export async function apiCreateShareLink(
  ownerId: string,
  id: string,
  role: ShareRole,
): Promise<ShareLink> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: ownerHeaders(ownerId),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`create share link failed: ${res.status}`);
  const { link } = (await res.json()) as ShareLinkResponse;
  return link;
}

export async function apiDeleteShareLink(ownerId: string, id: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share/${code}`, {
    method: 'DELETE',
    headers: { 'X-Owner-Id': ownerId },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete share link failed: ${res.status}`);
  }
}

export async function apiShareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'POST',
    headers: ownerHeaders(ownerId),
  });
  if (!res.ok) throw new Error(`share failed: ${res.status}`);
  return (await res.json()) as ShareResponse;
}

export async function apiUnshareDiagram(
  ownerId: string,
  id: string,
): Promise<{ shareable: boolean; shareCode: string | null }> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/share`, {
    method: 'DELETE',
    headers: ownerHeaders(ownerId),
  });
  if (!res.ok) throw new Error(`unshare failed: ${res.status}`);
  return (await res.json()) as ShareResponse;
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
    headers: logAuthHeaders(ownerId, shareCode),
    body: JSON.stringify({ name: d.name, tabIds: d.tabIds }),
  });
  if (!res.ok) throw new Error(`save diagram meta failed: ${res.status}`);
}

// Create a brand-new diagram with an optional initial set of tabs.
// Returns the meta + tab summaries the API stored. The live app uses
// this when the welcome flow commits a fresh id so the very first
// per-tab fetch lands on a populated row.
export async function apiCreateDiagram(
  ownerId: string,
  d: { id: string; name: string; tabs?: Tab[] },
): Promise<StoredDiagram> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    method: 'POST',
    headers: ownerHeaders(ownerId),
    body: JSON.stringify({ id: d.id, name: d.name, tabs: d.tabs ?? [] }),
  });
  if (!res.ok) throw new Error(`create diagram failed: ${res.status}`);
  const { diagram } = (await res.json()) as DiagramResponse;
  return {
    id: diagram.id,
    ownerId: diagram.ownerId,
    name: diagram.name,
    tabs: diagram.tabs,
    shareable: diagram.shareable,
    shareCode: diagram.shareCode,
    savedAt: diagram.savedAt,
  };
}

// Full tab payload, including elements + per-tab metadata. Pulled
// lazily when the user opens a tab; the diagram-summary fetch only
// carries TabSummary rows.
export async function apiLoadTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<Tab | null> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
    headers: logAuthGetHeaders(ownerId, shareCode),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load tab failed: ${res.status}`);
  const { tab } = (await res.json()) as TabResponse;
  // Strip the server-only fields before handing back the live-app's
  // Tab shape.
  const { diagramId: _did, orderIndex: _oi, updatedAt: _ua, ...clientTab } = tab;
  void _did;
  void _oi;
  void _ua;
  return clientTab;
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
    headers: logAuthHeaders(ownerId, shareCode),
    body: JSON.stringify(tab),
  });
  if (!res.ok) throw new Error(`save tab failed: ${res.status}`);
}

export async function apiDeleteTab(
  ownerId: string,
  diagramId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/tabs/${tabId}`, {
    method: 'DELETE',
    headers: logAuthGetHeaders(ownerId, shareCode),
  });
  if (!res.ok && res.status !== 404) throw new Error(`delete tab failed: ${res.status}`);
}

export async function apiDeleteDiagram(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`delete failed: ${res.status}`);
}

export async function apiListDiagrams(ownerId: string): Promise<DiagramSummary[]> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    headers: { 'X-Owner-Id': ownerId },
  });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { diagrams } = (await res.json()) as ListResponse;
  return diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    shareable: d.shareable,
    shareCode: d.shareCode,
    savedAt: d.savedAt,
  }));
}

export async function apiLoadSelf(id: string): Promise<Participant | null> {
  const res = await fetch(`${API_BASE}/participants/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`load self failed: ${res.status}`);
  const { participant } = (await res.json()) as ParticipantResponse;
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
  if (!res.ok) throw new Error(`save self failed: ${res.status}`);
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
  | { kind: 'cursor'; tabId: string; x: number | null; y: number | null };

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
