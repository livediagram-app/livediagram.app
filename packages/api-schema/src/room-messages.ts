import type { ElementOp, Tab } from '@livediagram/diagram';
import type { ChangeLogEntry, ParticipantPresence } from './index';

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
  // `seq`/`epoch` ride mutation ops only (spec/75, Level 1): the room
  // assigns each mutation a monotonic sequence within an `epoch` (a random
  // id minted per DO instantiation) so a reconnecting client can ask what
  // it missed. Presence ops (cursor/select/laser/tab-focus) carry neither —
  // they're ephemeral and unordered. Both fields absent = an older room or
  // a presence op; clients treat that as "no ordering info", unchanged.
  | { kind: 'op'; from: string; op: unknown; seq?: number; epoch?: string }
  // Reply to a client `sync` (spec/75, Level 1). Either a replayable delta
  // (`ops` the client missed, in seq order, `resync: false`) or an
  // instruction to fully re-hydrate (`resync: true`, `ops` empty) when the
  // gap can't be bridged from the room's bounded in-memory op log.
  | {
      kind: 'catchup';
      epoch: string;
      seq: number;
      ops: { from: string; op: unknown; seq: number }[];
      resync: boolean;
    };

// Incoming WebSocket frames clients send to the room.
// `hello` identifies the participant on connect; `op` is any local
// mutation the client wants rebroadcast to peers.
export type ClientMessage =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: unknown }
  // Sent right after re-connecting (spec/75, Level 1): "here's the last
  // epoch+seq I applied — tell me what I missed, or that I must re-hydrate".
  // `epoch` is null on a client that hasn't seen an ordered op yet.
  | { kind: 'sync'; epoch: string | null; lastSeq: number };

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
  // they edited. Receivers merge by id. Kept as a fallback for bulk
  // changes and older peers; the granular `el` op (spec/75) supersedes it
  // for the common single-element edit so concurrent different-element
  // edits stop clobbering.
  | { kind: 'tab'; tabId: string; tab: Tab }
  // A single element on a tab changed (spec/75, Level 0): add / update /
  // remove / reorder, applied by id so a peer editing a DIFFERENT element
  // on the same tab merges instead of overwriting the whole tab. `op`
  // carries the element payload (see @livediagram/diagram ElementOp).
  | { kind: 'el'; tabId: string; op: ElementOp }
  // A tab's non-element metadata changed (name, background, font, …) —
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  | { kind: 'tab-meta'; tabId: string; patch: Partial<Omit<Tab, 'elements'>> }
  // A Yjs document update (spec/75, Level 2), base64-encoded. Broadcast on
  // every commit when the Yjs-realtime flag is on; the room applies it to
  // its authoritative doc and relays it. Supersedes `el`/`tab-meta`/`tab`
  // for those sessions (field-level same-element merge). Older / flag-off
  // peers ignore it, so mixed sessions simply don't share the doc path.
  | { kind: 'ydoc'; update: string }
  // A joining Level 2 client asks the room for the shared doc's current
  // state (so every peer shares ONE doc history — the prerequisite for
  // field-level merge). Handled by the room, never relayed to peers.
  | { kind: 'ydoc-sync' }
  // The room's reply to `ydoc-sync`: the encoded doc state, or `null` when
  // the room holds no doc yet (the joiner then seeds from its D1 hydrate
  // and broadcasts that seed so the room adopts it).
  | { kind: 'ydoc-state'; update: string | null }
  // Diagram-level metadata changed: rename, tab reorder, tab add /
  // delete. Carries the new ordered list of tab summaries (id + name
  // + order) so receivers can update the TabBar without fetching the
  // full tab payloads.
  | {
      kind: 'diagram-meta';
      name: string;
      // `folder` (spec/30) is the per-diagram folder name, optional so
      // an older peer that omits it is treated as loose — no parse break.
      tabs: { id: string; name: string; orderIndex: number; folder?: string }[];
    }
  // `tabId` scopes the selection to the tab it lives on: element ids
  // are only unique per tab in older diagrams (tab duplication used to
  // copy ids verbatim), so an unscoped selection rendered — and, via
  // the spec/07 concurrent-selection lock, LOCKED — the same-id element
  // on every other tab too. Optional for wire compatibility: a frame
  // without it is treated as tab-unknown and shown everywhere (the old
  // behaviour).
  | { kind: 'select'; elementId: string | null; tabId?: string }
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
  | { kind: 'laser'; tabId: string; x: number; y: number }
  // A share link was revoked by the diagram owner. Every connected
  // peer using that share code (the `X-Share-Code` they handed in to
  // hydrate) should hard-redirect to a "share revoked" surface so
  // they don't continue to read or hold open a stale connection.
  // Carries only the revoked code; viewers compare against their own
  // sessionShareCode and act only if it matches.
  | { kind: 'share-revoked'; code: string };

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown` — the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: RoomOp }
  | { kind: 'sync'; epoch: string | null; lastSeq: number };

export type RoomIncoming =
  | { kind: 'presence'; participants: ParticipantPresence[] }
  | { kind: 'op'; from: string; op: RoomOp; seq?: number; epoch?: string }
  | {
      kind: 'catchup';
      epoch: string;
      seq: number;
      ops: { from: string; op: RoomOp; seq: number }[];
      resync: boolean;
    };
