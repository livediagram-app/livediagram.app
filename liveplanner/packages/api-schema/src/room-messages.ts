import type { AgentPresence } from '@liveworkspace/api-schema/agent-presence';
import type { DashboardPatch, ElementDelta, RoomElementOp, Tab } from '@liveplanner/project';
import type { ParticipantPresence } from './index';
import type { DragPreviewPatch } from './drag-preview';
import type { ChangesetRoomOp } from './changesets';
import type { ItemsRoomOp, ItemTypesRoomOp } from './items';
import type { CardThreadsRoomOp } from './card-threads';
import type { SheetsRoomOp } from './sheets';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// Room op kinds that are ephemeral signals: they mutate no project state,
// so they relay unordered (no seq) and from any role.
//
// This classification used to live inside the room worker while the editor kept
// its own list of the kinds it sends and handles, in another app, with nothing
// comparing them, and the mutation branch is the fall-through, so a presence kind nobody
// classified silently becomes a logged, ordered, replayed mutation. The
// dangerous direction is worse — a MUTATION kind added to this list hands
// view-role visitors a write path, because the role gate only stops non-presence
// ops. So the whole vocabulary lives here now, in the package both ends already
// import, split into exactly three kinds with no room for a fourth.
export const PRESENCE_OP_KINDS = [
  'cursor',
  'select',
  'tab-focus',
  // A dragger's preview (docs/specs/008-canvas/drag-preview.md): where the elements they are moving are
  // right now, at cursor rates, writing nothing; the real change follows on release as element ops.
  // The room relays it only from an editor (receivers check too): a viewer must never make others'
  // elements appear to move.
  'drag-preview',
  // Whose hands are on a Plan board's card (docs/specs/026-plan/plan-board.md "What the board shows"):
  // the card someone is dragging or reading, so peers ring it in their colour. Ephemeral, never
  // logged, from any session (a viewer reads items too).
  'plan-presence',
  // Someone's selection on a sheet (docs/specs/029-sheets/sheet.md "Collaboration"): outlined in their colour.
  // Ephemeral, never logged, from any session (a viewer selects too).
  'sheet-presence',
] as const;

// Room op kinds that DO change the project: they get a monotonic `seq` within
// the room's epoch, land in the bounded catch-up log so a reconnecting peer can
// replay them (docs/specs/012-collaboration/realtime-conflict-resolution.md), and are refused from a view-role sender.
export const MUTATION_OP_KINDS = [
  'tab',
  'tab-meta',
  'el',
  // One dot placed or taken back (docs/specs/012-collaboration/session-tools.md). A mutation like any other — it
  // gets a seq, lands in the catch-up log, and is refused from a view-role
  // sender, because casting already requires edit rights.
  'vote',
  // One answer, idea, checklist tick or comment change on one element
  // (docs/specs/012-collaboration/collab-race-hardening.md). A mutation for the same reasons as a dot.
  'el-delta',
  'project-meta',
  // One change to a Dashboard's layout (docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout
  // travels as deltas"). A mutation like `el-delta`: sequenced, logged, recorded in the ledger, and an Editor's alone
  // (not a participation op, so a Participant's or a Viewer's socket has it dropped).
  'dashboard-delta',
] as const;

// Op kinds only the WORKER may originate, stamped `from: 'system'` and pushed
// through the room's /broadcast endpoint. The room drops them outright when they
// arrive on a client socket: without that, any edit-role peer could forge
// `share-revoked` carrying the code from their own URL and force-redirect every
// collaborator out of the session (docs/specs/013-workspace/share-password.md).
//
// `share-rescoped` (docs/specs/013-workspace/tab-scoped-share-links.md) for the same reason as
// `share-revoked`: a forged one would reload every holder of a code.
//
// `project-trashed` (docs/specs/013-workspace/trash.md): the project went to the
// Trash, so every session ends with the deleted state. A forged one would end
// everyone's session.
//
// `changeset` (docs/specs/024-agents/agent-changesets.md): one write the api applied and recorded,
// sequenced through /mutation. A forged one would show people a change nobody made (CS24).
//
// `items` (docs/specs/026-plan/items.md "Live for everyone"): item writes the api made. Items change
// only through the api, so a forged one would show people items nobody wrote. `item-types` likewise
// (docs/specs/026-plan/item-types.md): the catalogue changes only through the api.
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'project-trashed',
  'changeset',
  'items',
  'item-types',
  // `sheets` (docs/specs/029-sheets/sheet-store.md "Live for everyone"): sheet writes the api made. Sheets change
  // only through the api, so a forged one would show people cells nobody wrote.
  'sheets',
  // `threads` (docs/specs/026-plan/items.md "Comments"): card thread writes the api made, from any plan the thread
  // is on. Threads change only through the api.
  'threads',
] as const;

// The whole vocabulary. Every op the editor sends or handles is one of these
// three kinds of thing, and which one it is decides its ordering, its role gate,
// and whether it may come from a client at all.
export const ROOM_OP_KINDS = [
  ...PRESENCE_OP_KINDS,
  ...MUTATION_OP_KINDS,
  ...SYSTEM_OP_KINDS,
] as const;

type PresenceOpKind = (typeof PRESENCE_OP_KINDS)[number];

// Membership test for the room's ordering + role gate. Takes a loose string
// because it reads `op.kind` off an `unknown` wire payload (see ServerMessage
// below on why the op itself stays untyped).
export function isMutationOpKind(kind: unknown): kind is (typeof MUTATION_OP_KINDS)[number] {
  return typeof kind === 'string' && (MUTATION_OP_KINDS as readonly string[]).includes(kind);
}

export function isPresenceOpKind(kind: unknown): kind is PresenceOpKind {
  return typeof kind === 'string' && (PRESENCE_OP_KINDS as readonly string[]).includes(kind);
}

// A participation act (docs/specs/013-workspace/share-roles.md "Integrity"): a person's own dot, response or idea.
// A Participant's socket may send these beside presence; every other mutation from it is dropped, except an `el`
// op, which the room applies through the participant content rule instead of relaying.
const PARTICIPATION_OP_KINDS = ['vote'] as const;
// A comment reaction is taking part too (docs/specs/012-collaboration/comment-reactions.md): whoever may comment
// may react, and the room writes a Participant's reactions as it writes its answers.
const PARTICIPATION_DELTA_KINDS = ['response', 'comment-react'] as const;

export function isParticipationOp(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const { kind, delta } = op as { kind?: unknown; delta?: unknown };
  if ((PARTICIPATION_OP_KINDS as readonly unknown[]).includes(kind)) return true;
  if (kind !== 'el-delta' || typeof delta !== 'object' || delta === null) return false;
  return (PARTICIPATION_DELTA_KINDS as readonly unknown[]).includes(
    (delta as { kind?: unknown }).kind,
  );
}

export function isSystemOpKind(kind: unknown): kind is (typeof SYSTEM_OP_KINDS)[number] {
  return typeof kind === 'string' && (SYSTEM_OP_KINDS as readonly string[]).includes(kind);
}

// Outgoing WebSocket frames the room sends to clients.
// `presence` is the full participant list refreshed on join / leave;
// `op` is an arbitrary project change rebroadcast from another client.
// `op` is intentionally `unknown` so the room itself stays agnostic
// of the client's op union — clients narrow it via their own
// `RoomOp` type and ignore frames they don't recognise.
export type ServerMessage =
  // `agents`: agent presence, apart from `participants` so no session reader counts one (agent-presence PR14).
  | { kind: 'presence'; participants: ParticipantPresence[]; agents: AgentPresence[] }
  // `seq`/`epoch` ride mutation ops only (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): the room
  // assigns each mutation a monotonic sequence within an `epoch` (a random
  // id minted per DO instantiation) so a reconnecting client can ask what
  // it missed. Presence ops (cursor/select/tab-focus) carry neither —
  // they're ephemeral and unordered. Both fields absent = an older room or
  // a presence op; clients treat that as "no ordering info", unchanged.
  | { kind: 'op'; from: string; op: unknown; seq?: number; epoch?: string }
  // Reply to a client `sync` (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). Either a replayable delta
  // (`ops` the client missed, in seq order, `resync: false`) or an
  // instruction to fully re-hydrate (`resync: true`, `ops` empty) when the
  // gap can't be bridged from the room's bounded in-memory op log.
  | {
      kind: 'catchup';
      epoch: string;
      seq: number;
      ops: { from: string; op: unknown; seq: number }[];
      resync: boolean;
    }
  // The ordering cursor this session has reached (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1), sent on
  // `hello` and to the SENDER of each ordered op, which the relay skips. Without
  // it a client only learned seqs from other people's ops, so a reconnect
  // replayed its own ops back at it (and, having heard nothing, the whole log).
  // Harmless for idempotent element ops; a `vote` op is a delta, so every
  // replayed dot was counted twice.
  | CursorMessage
  | FormatMessage
  | GrantRenewMessage;

// `ref`: the `ref` the sender put on the op this frame answers, echoed so the sender knows that op is
// sequenced (docs/specs/012-collaboration/collab-race-hardening.md phase 6). Absent on hello.
export type CursorMessage = { kind: 'cursor'; epoch: string; seq: number; ref?: number };

// A `ref` the room echoes: a positive safe integer, nothing else.
export function isRoomOpRef(ref: unknown): ref is number {
  return typeof ref === 'number' && Number.isSafeInteger(ref) && ref > 0;
}

// The server's project format number (docs/specs/016-platform/new-version-prompt.md), sent to
// each socket on `hello`: a deploy restarts the room, so every open editor hears it on reconnect.
// `build`: the live build id when the deploy set one (docs/specs/016-platform/stale-builds.md).
export type FormatMessage = { kind: 'format'; format: number; build?: string };

// Incoming WebSocket frames clients send to the room.
// `hello` identifies the participant on connect; `op` is any local
// mutation the client wants rebroadcast to peers.
export type ClientMessage =
  | { kind: 'hello'; participant: ParticipantPresence }
  // `ref`: asks the room to echo it on this op's `cursor` frame (CursorMessage).
  | { kind: 'op'; op: unknown; ref?: number }
  // Sent right after re-connecting (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): "here's the last
  // epoch+seq I applied — tell me what I missed, or that I must re-hydrate".
  // `epoch` is null on a client that hasn't seen an ordered op yet.
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | GrantMessage
  // An identity update over an open socket (docs/specs/014-identity/profile-and-email-notifications.md "Profile
  // pictures"): the same participant fields as `hello`, read by the same rules, without re-joining. Today it carries
  // a Google picture switched on or off. Ignored before the session's hello.
  | { kind: 'identity'; participant: ParticipantPresence };

// The session's grant is about to lapse (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): the room asks
// for a fresh one ROOM_GRANT_ASK_BEFORE_MS before it does, and drops the socket (GRANT_LAPSED_CLOSE) when none
// came by then. `expiresAt`: when the session's grant runs out, epoch ms.
export type GrantRenewMessage = { kind: 'grant-renew'; expiresAt: number };

// A fresh grant for this session, the index's ES256 JWT (or the api's room ticket, for a client that has no
// grant of its own). The room checks it as it checked the first, and keeps the session to what it now allows.
export type GrantMessage = { kind: 'grant'; grant: string };

// How long before a session's grant lapses the room asks for a new one. The editor renews on its own a minute
// before expiry (GRANT_RENEW_BEFORE_S), so the ask is the fallback; 30 s leaves a slow renewal room to land.
export const ROOM_GRANT_ASK_BEFORE_MS = 30_000;

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
  // The sender just switched to (or initially focused) a tab. Drives
  // the per-tab avatar dots in the TabBar so collaborators can see at
  // a glance which tab each peer is working on.
  // `besideTabId`: the tab in the sender's other pane while they work side by side
  // (docs/specs/007-editor/split-view.md "Presence"); absent or null with no split.
  | { kind: 'tab-focus'; tabId: string; besideTabId?: string | null }
  // A single tab's content changed. The post-refactor replacement for
  // the heavyweight `tabs` op below — sender ships only the one tab
  // they edited. Receivers merge by id. Kept as a fallback for bulk
  // changes and older peers; the granular `el` op (docs/specs/012-collaboration/realtime-conflict-resolution.md) supersedes it
  // for the common single-element edit so concurrent different-element
  // edits stop clobbering.
  //
  // `dashboardDeltas`: the sender sends its Dashboard layout changes as `dashboard-delta` ops, so a receiver that has
  // a layout keeps its own through this copy (docs/specs/012-collaboration/collab-race-hardening.md). Absent from an
  // older editor, whose whole layout is taken as before.
  | { kind: 'tab'; tabId: string; tab: Tab; dashboardDeltas?: true }
  // A single element on a tab changed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0): add / update /
  // remove / reorder, applied by id so a peer editing a DIFFERENT element
  // on the same tab merges instead of overwriting the whole tab. `op`
  // carries the element payload (see @liveplanner/project ElementOp).
  | { kind: 'el'; tabId: string; op: RoomElementOp }
  // A tab's non-element metadata changed (name, background, font, …) —
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  //
  // `clear` names fields the sender REMOVED (Clear Timer, Clear Vote, a reset
  // background). A removed field serialises to nothing inside `patch`, so it
  // used to force a whole-`tab` op, which replaced every element on every
  // receiver and wiped their unsaved presses (docs/specs/012-collaboration/collab-race-hardening.md).
  | {
      kind: 'tab-meta';
      tabId: string;
      patch: Partial<Omit<Tab, 'elements'>>;
      clear?: string[];
    }
  // ONE dot, placed (`delta: 1`) or taken back (`delta: -1`) by `voter` on
  // `elementId` (docs/specs/012-collaboration/session-tools.md).
  //
  // Why a dot is not just a `tab-meta` patch, which is what it used to be:
  // `vote.votes` is a single map that EVERY participant writes at the same
  // time, and a tab-meta patch replaces a field wholesale. So a peer's patch,
  // built from a snapshot taken before your dot arrived, silently erased it —
  // and because the remaining-dots budget is counted out of that same map, the
  // dot came back to its owner as spendable. A retro with six voters lost dots
  // and reported votes retracting on their own.
  //
  // This op carries the CHANGE rather than the state, so two dots cast in the
  // same instant commute: each peer applies both, in whatever order they land,
  // and everybody converges on the same map. It is the same move docs/specs/012-collaboration/realtime-conflict-resolution.md made
  // for elements, for the same reason, on the one field where concurrent
  // writers are not the exception but the whole point.
  //
  // `round` names the vote the dot was cast in (docs/specs/012-collaboration/collab-race-hardening.md): a receiver drops a
  // dot for any other round, or for a vote that has closed. Optional so a
  // peer on an older client still parses.
  // ONE change to a field many people write at once: an answer, an idea, a
  // checklist tick, a comment (docs/specs/012-collaboration/collab-race-hardening.md). The `vote` op's reasoning, applied to
  // element fields: a whole-element `el` update replaced a peer's copy with the
  // sender's snapshot, so two people pressing the same done check lost a mark.
  | { kind: 'el-delta'; tabId: string; elementId: string; delta: ElementDelta }
  // ONE change to a Dashboard's layout, by row and slot id (docs/specs/012-collaboration/collab-race-hardening.md
  // "A Dashboard's layout travels as deltas"): the `el-delta` reasoning for the one tab field two Editors change at
  // once. The whole layout used to ride `tab-meta`, so each receiver took the other's layout and lost its own change.
  | { kind: 'dashboard-delta'; tabId: string; patch: DashboardPatch }
  | {
      kind: 'vote';
      tabId: string;
      elementId: string;
      voter: string;
      delta: 1 | -1;
      round?: string;
    }
  // Project-level metadata changed: rename, tab reorder, tab add /
  // delete. Carries the new ordered list of tab summaries (id + name
  // + order) so receivers can update the TabBar without fetching the
  // full tab payloads.
  | {
      kind: 'project-meta';
      name: string;
      // `folder` (docs/specs/006-project/tab-folders.md) is the per-project folder name, optional so
      // an older peer that omits it is treated as loose — no parse break.
      // `outOfScope` marks a tab outside a tab-scoped session's scope
      // (docs/specs/013-workspace/tab-scoped-share-links.md): its name is blanked by the room.
      tabs: { id: string; name: string; orderIndex: number; folder?: string; outOfScope?: true }[];
    }
  // `tabId` scopes the selection to the tab it lives on: element ids
  // are only unique per tab in older projects (tab duplication used to
  // copy ids verbatim), so an unscoped selection rendered — and, via
  // the docs/specs/007-editor/editor-app.md concurrent-selection lock, LOCKED — the same-id element
  // on every other tab too. Optional for wire compatibility: a frame
  // without it is treated as tab-unknown and shown everywhere (the old
  // behaviour).
  //
  // `elementIds` is the whole selection (the multi-selection, or the single one), capped at
  // MAX_SELECTION_IDS: the room records it so the api can refuse an agent changeset on an element a
  // person holds (docs/specs/024-agents/agent-changesets.md "Held elements"). A sender that omits it
  // holds `[elementId]`.
  | { kind: 'select'; elementId: string | null; tabId?: string; elementIds?: string[] }
  // Cursor position in canvas coordinates. `null` means the cursor
  // left the canvas surface so peers can hide their indicator. The
  // active tab id is included so we only render cursors of
  // participants who are looking at the same tab as us.
  | { kind: 'cursor'; tabId: string; x: number | null; y: number | null }
  // A dragger's live preview (docs/specs/008-canvas/drag-preview.md): one geometry patch per changed
  // element; `end` says the preview is over, `landed` that it was written (the real change follows as
  // element ops, after the autosave's wait), so receivers keep drawing it until then.
  | { kind: 'drag-preview'; tabId: string; patches?: DragPreviewPatch[]; end?: true; landed?: true }
  // The card the sender is dragging or reading on a Plan board (docs/specs/026-plan/plan-board.md), or
  // none (itemId null). Presence: relayed as is, never stored.
  | { kind: 'plan-presence'; tabId: string; itemId: string | null; state?: 'drag' | 'view' }
  // The sender's selection on a sheet (docs/specs/029-sheets/sheet.md "Collaboration"), by ids, or none.
  | {
      kind: 'sheet-presence';
      tabId: string;
      sheetId: string;
      ranges: { r1: string; c1: string; r2: string; c2: string }[] | null;
      editing: boolean;
    }
  // A share link was revoked by the project owner. Every connected
  // peer using that share code (the `X-Share-Code` they handed in to
  // hydrate) should hard-redirect to a "share revoked" surface so
  // they don't continue to read or hold open a stale connection.
  // Carries only the revoked code; viewers compare against their own
  // sessionShareCode and act only if it matches.
  | { kind: 'share-revoked'; code: string }
  // The named share link changed scope (docs/specs/013-workspace/tab-scoped-share-links.md). Sessions that
  // hydrated with that code reload into the new scope; the room closes their
  // sockets. Worker-originated, like share-revoked.
  | { kind: 'share-rescoped'; code: string }
  // One changeset the api applied (docs/specs/024-agents/agent-changesets.md "What the room does").
  // Worker-originated through /mutation.
  | ChangesetRoomOp
  // Item writes the api made (docs/specs/026-plan/items.md "Live for everyone"). Worker-originated
  // through an ordered /broadcast; a session scoped to one tab hears it without its items.
  | ItemsRoomOp
  // A project's type catalogue the api stored (docs/specs/026-plan/item-types.md "Storage and sync").
  | ItemTypesRoomOp
  // Sheet writes the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"). Worker-originated
  // through an ordered /broadcast; a session scoped to one tab hears only its tab's.
  | SheetsRoomOp
  // A card comment thread's write (docs/specs/026-plan/items.md "Comments"), from any plan the thread is on.
  // Worker-originated through an ordered /broadcast; a session scoped to one tab hears it without its threads.
  | CardThreadsRoomOp
  // The project went to the Trash (docs/specs/013-workspace/trash.md). Every
  // session shows the deleted state; the room then closes every socket (4004).
  // Worker-originated, like share-revoked.
  | { kind: 'project-trashed' };

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown` — the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: RoomOp; ref?: number }
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | GrantMessage
  | { kind: 'identity'; participant: ParticipantPresence };

export type RoomIncoming =
  | { kind: 'presence'; participants: ParticipantPresence[]; agents?: AgentPresence[] }
  | { kind: 'op'; from: string; op: RoomOp; seq?: number; epoch?: string }
  | {
      kind: 'catchup';
      epoch: string;
      seq: number;
      ops: { from: string; op: RoomOp; seq: number }[];
      resync: boolean;
    }
  | CursorMessage
  | FormatMessage
  | GrantRenewMessage;

// The WebSocket close code the realtime room ends a session with when an access
// change narrows who may be in it without revoking a link (docs/specs/015-api/api.md
// "Access changes end the sessions they affect"): a share password set, or a
// member leaving their team. Beside 4003 (a share link changed) and 4004 (the
// project was trashed). The editor reloads into the ordinary access path.
export const ACCESS_CHANGED_CLOSE = 4005;

// The close code for a workbench session whose pairing or token ended (docs/specs/013-workspace/workbench-embeds.md):
// the page turns read-only and does not reconnect.
export const WORKBENCH_ENDED_CLOSE = 4006;

// The close code for a session whose grant lapsed without a fresh one (GrantRenewMessage): the editor fetches a
// new grant and reconnects.
export const GRANT_LAPSED_CLOSE = 4007;

// A room past its connection cap closes the newcomer with ROOM_FULL_CLOSE (4008); the editor says the plan is full
// and tries again later (docs/specs/015-api/api.md "A room holds 100 connections"). One cap for every product.
export {
  ROOM_MAX_CONNECTIONS,
  ROOM_FULL_CLOSE,
  ROOM_FULL_MESSAGE,
  ROOM_FULL_REASON,
  ROOM_FULL_RETRY_MS,
  roomIsFull,
} from '@liveworkspace/api-schema/room-capacity';

// A request about one plan carries the index's grant for it here (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Grants"), so `Authorization` keeps the person's own token. The api checks it offline against the index's keys.
// A caller with no grant (an API token, a workbench session) has one fetched for it by the api.
export const INDEX_GRANT_HEADER = 'X-Index-Grant';

// The room's keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"): the client sends
// the bare text ROOM_PING on an idle socket and the room answers ROOM_PONG without waking from hibernation
// (setWebSocketAutoResponse). Plain text, never JSON, so neither side's message handler ever sees them as ops.
export const ROOM_PING = 'ping';
export const ROOM_PONG = 'pong';
