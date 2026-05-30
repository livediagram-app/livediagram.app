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

export type StoredDiagram = {
  id: string;
  ownerId: string;
  name: string;
  tabs: Tab[];
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
    tabs: Tab[];
    shareable: boolean;
    shareCode: string | null;
    savedAt: number;
    createdAt: number;
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

export async function apiListChangeLog(ownerId: string, id: string): Promise<ChangeLogEntry[]> {
  const res = await fetch(`${API_BASE}/diagrams/${id}/log`, {
    headers: { 'X-Owner-Id': ownerId },
  });
  if (!res.ok) throw new Error(`list change log failed: ${res.status}`);
  const { entries } = (await res.json()) as ChangeLogListResponse;
  return entries;
}

export async function apiAppendChangeLogEntry(
  ownerId: string,
  entry: Omit<ChangeLogEntry, 'diagramId'> & { diagramId: string },
): Promise<ChangeLogEntry> {
  const res = await fetch(`${API_BASE}/diagrams/${entry.diagramId}/log`, {
    method: 'POST',
    headers: ownerHeaders(ownerId),
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
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/log/tab/${tabId}`, {
    method: 'DELETE',
    headers: { 'X-Owner-Id': ownerId },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete change log failed: ${res.status}`);
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

export async function apiSaveDiagram(
  ownerId: string,
  d: { id: string; name: string; tabs: Tab[] },
): Promise<void> {
  const res = await fetch(`${API_BASE}/diagrams/${d.id}`, {
    method: 'PUT',
    headers: ownerHeaders(ownerId),
    body: JSON.stringify({ name: d.name, tabs: d.tabs }),
  });
  // PUT upserts, but the first save on a new id could 404 if the API
  // gate were stricter — today PUT always upserts so the only error path
  // is network. Throw so the caller can show "save failed" UI.
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
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
  | { kind: 'tabs'; tabs: Tab[]; name: string }
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
