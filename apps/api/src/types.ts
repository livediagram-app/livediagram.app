import type { Tab } from '@livediagram/diagram';

// The single API DTO for a diagram + its tab summaries. After the
// per-tab storage refactor (spec/13-per-tab-storage.md), `tabs` is a
// list of TabSummaryDTO (id + name + order) — element content is
// fetched per-tab via GET /diagrams/:id/tabs/:tabId. Older clients
// that still expect the full Tab payload were retired ahead of this
// change.
export type DiagramDTO = {
  id: string;
  ownerId: string;
  name: string;
  tabs: TabSummaryDTO[];
  // Sharing state. `shareable` is the on/off switch the owner toggles
  // via POST/DELETE /api/diagrams/:id/share. `shareCode` is the short
  // code that goes into the share URL; NULL when never shared, rotated
  // when re-shared after a revoke.
  shareable: boolean;
  shareCode: string | null;
  savedAt: number;
  createdAt: number;
};

// One row of `tabs`. Lives as JSON in the live app's `Tab` type;
// stored in D1 with id + diagram_id + name + order_index as columns
// and the rest of the payload as a JSON `data` column.
export type TabDTO = Tab & {
  diagramId: string;
  orderIndex: number;
  updatedAt: number;
};

// Lightweight projection used inside DiagramDTO and for tab list
// endpoints — drops `data` so the diagram summary doesn't ship every
// tab's element tree.
export type TabSummaryDTO = {
  id: string;
  diagramId: string;
  name: string;
  orderIndex: number;
  updatedAt: number;
};

// Lightweight projection for list endpoints — drops `tabs` entirely
// so listing 100 diagrams doesn't ship 100 tab arrays either.
export type DiagramSummary = {
  id: string;
  ownerId: string;
  name: string;
  shareable: boolean;
  shareCode: string | null;
  savedAt: number;
  createdAt: number;
};

export type ParticipantDTO = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export type ShareRole = 'edit' | 'view';

export type ShareLinkDTO = {
  code: string;
  diagramId: string;
  role: ShareRole;
  createdAt: number;
};

// One row of the audit log. See specs/12-activity-and-audit.md.
// `beforeState` / `afterState` are objects keyed by element id; `null`
// on either side means the element didn't exist on that side of the
// change (an add has before=null, a delete has after=null).
export type ChangeLogKind = 'add' | 'edit' | 'delete' | 'revert';

export type ChangeLogEntryDTO = {
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

export type Env = {
  DB: D1Database;
  DIAGRAM_ROOM: DurableObjectNamespace;
};

// Outgoing WebSocket message types. Clients see `presence` (full list of
// connected participants in this room) and `op` (an arbitrary diagram
// change pushed by another client — schema deliberately permissive so
// the room doesn't need to evolve as the editor adds new op kinds).
export type ServerMessage =
  | { kind: 'presence'; participants: ParticipantPresence[] }
  | { kind: 'op'; from: string; op: unknown };

// Incoming WebSocket message types. `hello` is sent on connect to
// identify the participant; `op` is any local mutation the client
// wants other clients to apply.
export type ClientMessage =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: unknown };

export type ParticipantPresence = {
  id: string;
  name: string;
  color: string;
};
