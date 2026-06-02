// Wire-format type definitions for the livediagram API — the single
// source of truth for what travels between the `api` Cloudflare
// Worker and the `live` Next.js editor.
//
// Both the server (which constructs these payloads from D1 rows) and
// the client (which consumes them in api-client.ts) import from here,
// so the two sides cannot drift. Adding a new field on the server
// without updating the client (or vice versa) used to be a routine
// hazard; defining the shapes once means the typechecker catches it.
//
// Naming convention: bare nouns (`Diagram`, `Folder`, `ShareLink`).
// Each app re-exports under its own historical aliases — the api
// worker continues to use `DiagramDTO` etc. internally, the live app
// continues to use `StoredDiagram` — so this extraction is a
// drop-in. New code should prefer the canonical names here.

import type { Tab } from '@livediagram/diagram';

// ---------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------

// Full diagram payload returned by `GET /api/diagrams/:id`. After
// per-tab storage (spec/13), `tabs` is a list of `TabSummary`
// (metadata only) — element content is fetched separately via
// `GET /api/diagrams/:id/tabs/:tabId`.
export type Diagram = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummary[];
  // Sharing state. `shareable` is the on/off switch the owner toggles
  // via POST/DELETE /api/diagrams/:id/share. `shareCode` is the short
  // code that goes into the share URL; null when never shared,
  // rotated when re-shared after a revoke.
  shareable: boolean;
  shareCode: string | null;
  // Folder placement. null means the diagram is in the conceptual
  // Unsorted bucket. See spec/15.
  folderId: string | null;
  savedAt: number;
  createdAt: number;
};

// Lightweight list projection — drops `tabs` so listing 100 diagrams
// doesn't ship 100 tab arrays.
export type DiagramSummary = {
  id: string;
  ownerId: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  folderId: string | null;
  savedAt: number;
  createdAt: number;
};

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

// One row of `Diagram.tabs`. Stored in D1 with id + diagram_id + name
// + order_index as columns and the rest of the payload as a JSON
// `data` column. The summary projection is what list / diagram
// responses ship; the full payload (below) is fetched per-tab on
// demand so the editor only ever holds the tabs the user opens.
export type TabSummary = {
  id: string;
  diagramId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
};

// Full tab payload returned by `GET /api/diagrams/:id/tabs/:tabId`:
// the editor's `Tab` (elements + comments + theme + canvas) plus the
// row's audit metadata.
export type TabRecord = Tab & {
  diagramId: string;
  orderIndex: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Folders (spec/15)
// ---------------------------------------------------------------------

// A folder row. `parentId === null` means the folder lives at the
// tree root.
export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------
// Share links (spec/04, spec/11)
// ---------------------------------------------------------------------

export type ShareRole = 'edit' | 'view';

export type ShareLink = {
  code: string;
  diagramId: string;
  role: ShareRole;
  createdAt: number;
};

// ---------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------

// A persisted participant row, returned by `POST /api/participants`
// when the editor registers identity. The live app wraps this in its
// own `Participant` type that adds presence status (`online` / `away`
// / `stale`) on top — that status is purely client-derived from idle
// time and never crosses the wire.
export type ParticipantRecord = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

// What the realtime room broadcasts as presence. Identical shape to
// `ParticipantRecord` minus `createdAt` — presence is concerned with
// "who is connected right now", not when they first registered.
export type ParticipantPresence = {
  id: string;
  name: string;
  color: string;
};

// ---------------------------------------------------------------------
// Images (spec/19)
// ---------------------------------------------------------------------

// One row returned by `GET /api/images` (the gallery list) + the
// inner shape of the `POST /api/images` response (`{ image, deduped }`).
// The bytes themselves are fetched separately via
// `GET /api/images/<id>?d=<diagramId>` (owner or share-code gated).
export type ImageSummary = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName?: string;
  createdAt: number;
};

// ---------------------------------------------------------------------
// Change log (spec/12)
// ---------------------------------------------------------------------

export type ChangeLogKind = 'add' | 'edit' | 'delete' | 'revert';

// One row of the audit log. `beforeState` / `afterState` are objects
// keyed by element id; a null on either side means the element didn't
// exist on that side of the change (an add has before=null for that
// id, a delete has after=null).
export type ChangeLogEntry = {
  id: string;
  // Tab the change happened on. Nullable in the schema for legacy
  // diagram-scoped entries; new entries always carry a real id
  // (since #14 dropped the diagram_id column the tab id is now the
  // canonical pointer into the change_log → tabs → diagram_tabs
  // chain — see spec/17).
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

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// Outgoing WebSocket frames the room sends to clients.
// `presence` is the full participant list refreshed on join / leave;
// `op` is an arbitrary diagram change rebroadcast from another client.
// `op` is intentionally `unknown` so the room itself stays agnostic
// of the client's op union — clients narrow it via their own
// `RoomOp` type and ignore frames they don't recognise.
export type ServerMessage =
  | { kind: 'presence'; participants: ParticipantPresence[] }
  | { kind: 'op'; from: string; op: unknown };

// Incoming WebSocket frames clients send to the room.
// `hello` identifies the participant on connect; `op` is any local
// mutation the client wants rebroadcast to peers.
export type ClientMessage =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: unknown };

// ---------------------------------------------------------------------
// Realtime room — op vocabulary (client view)
// ---------------------------------------------------------------------

// The set of `op` kinds the live editor knows how to send + receive
// inside the room's `op` envelopes. The api worker's view
// (`ClientMessage` / `ServerMessage` above) keeps `op` as `unknown`
// so the Durable Object stays agnostic of editor evolution — it just
// rebroadcasts. The union below is what the editor narrows to on the
// receive side, and what it constructs on the send side. New op
// kinds grow this union (and matching handlers in the editor) —
// nothing in the api worker changes.
export type RoomOp =
  // A new audit-log entry just landed. Used to mirror activity into
  // every connected client's panel without a round-trip through D1.
  // The owner of the diagram is the persistent writer; everyone else
  // updates their local list when this op arrives.
  | { kind: 'log'; entry: ChangeLogEntry }
  // The named log entry was removed (e.g. via Undo or Revert). Other
  // clients drop it from their local list so the panel stays in sync.
  | { kind: 'log-remove'; entryId: string }
  // The sender just switched to (or initially focused) a tab. Drives
  // the per-tab avatar dots in the TabBar so collaborators can see at
  // a glance which tab each peer is working on.
  | { kind: 'tab-focus'; tabId: string }
  // A single tab's content changed. The post-refactor replacement for
  // the heavyweight `tabs` op below — sender ships only the one tab
  // they edited. Receivers merge by id.
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

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown` — the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: RoomOp };

export type RoomIncoming =
  | { kind: 'presence'; participants: ParticipantPresence[] }
  | { kind: 'op'; from: string; op: RoomOp };

// Canonical hash function for the X-Image-Sha256 wire-format header.
// Lives here so the client and server can't drift on the dedup key
// (see ./sha256.ts for the rationale).
export { sha256Hex } from './sha256';

// ---------------------------------------------------------------------
// Telemetry (spec/22)
// ---------------------------------------------------------------------
//
// Anonymous, first-party product events. Each event is three small
// fields: a `category` (the parent: Diagram, Element, …), an `action`
// (the verb: Created, Added, …), and an optional `type` (one
// app-defined reference value: 'Square', 'Edit', a template id …).
// NEVER carries user-generated content — no names, ids, or element
// text. Shared here so the live editor's emitter and the api worker's
// ingest validator use exactly one definition (and the public
// dashboard can only ever surface values from this closed vocabulary).

export const TELEMETRY_CATEGORIES = [
  'Diagram',
  'Element',
  'Tab',
  'Theme',
  'Canvas',
  'Template',
  'Comment',
  'Session',
] as const;
export type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[number];

export const TELEMETRY_ACTIONS = [
  'Created',
  'Deleted',
  'Added',
  'Removed',
  'Shared',
  'Joined',
  'Used',
  'Changed',
  'Exported',
  'Locked',
  'Unlocked',
  'Grouped',
  'Ungrouped',
  'Duplicated',
  'Renamed',
  'Reordered',
  'Linked',
] as const;
export type TelemetryAction = (typeof TELEMETRY_ACTIONS)[number];

export type TelemetryEvent = {
  category: TelemetryCategory;
  action: TelemetryAction;
  // One short, app-defined reference token (a shape kind, a share
  // role like 'Edit', an export format, a template id, a theme name).
  // Optional. Bounded by TELEMETRY_TYPE_PATTERN below so the public
  // dashboard can never render user-generated content even if a caller
  // misuses it.
  type?: string | null;
};

// Defence-in-depth bound on `type`: a short token of safe characters,
// not a fixed enum (so adding a new shape / template / theme doesn't
// touch this file). Rejects anything that looks like free text / UGC.
export const TELEMETRY_TYPE_PATTERN = /^[A-Za-z0-9 ._-]{1,40}$/;

// Validate one event against the closed vocabulary. The worker filters
// the ingest batch through this so only known, safe rows ever land in
// D1 / the public dashboard.
export function isValidTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  if (!TELEMETRY_CATEGORIES.includes(e.category as TelemetryCategory)) return false;
  if (!TELEMETRY_ACTIONS.includes(e.action as TelemetryAction)) return false;
  if (e.type === undefined || e.type === null) return true;
  return typeof e.type === 'string' && TELEMETRY_TYPE_PATTERN.test(e.type);
}

// The fixed dashboard windows (spec/22): no custom ranges, so queries
// stay simple and the summary response is cacheable.
export type TelemetryWindowKey = 'today' | 'last7' | 'last30';

export type TelemetryCount = {
  category: string;
  action: string;
  type: string | null;
  count: number;
};

export type TelemetryWindow = {
  total: number;
  rows: TelemetryCount[];
};

export type TelemetrySummary = {
  enabled: boolean;
  generatedAt: number;
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
};
