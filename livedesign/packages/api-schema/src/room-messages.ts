import type { AgentPresence } from './agent-presence';
import type { ElementDelta, RoomElementOp, Tab } from '@livedesign/document';
import type { ParticipantPresence } from './index';
import type { DragPreviewPatch } from './drag-preview';
import type { ChangesetRoomOp } from './changesets';
import type { PhotoOp } from '@livedesign/photo-engine';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// Room op kinds that are ephemeral signals: they mutate no document state,
// so they relay unordered (no seq) and from any role.
// This classification used to live inside the room worker while the editor kept
// its own list of the kinds it sends and handles, in another app, with nothing
// comparing them. That is how `viewport` shipped absent from here (see its note
// below): the mutation branch is the fall-through, so a presence kind nobody
// classified silently becomes a logged, ordered, replayed mutation. The
// dangerous direction is worse — a MUTATION kind added to this list hands
// view-role visitors a write path, because the role gate only stops non-presence
// ops. So the whole vocabulary lives here now, in the package both ends already
// import, split into exactly three kinds with no room for a fourth.
export const PRESENCE_OP_KINDS = [
  'cursor',
  'select',
  'laser',
  'tab-focus',
  // Where the sender is looking, for anyone following them (docs/specs/012-collaboration/follow-me-viewport.md). Its
  // own wire contract calls it "ephemeral presence exactly like cursor /
  // laser: throttled, never logged, never ordered (no `seq`), never
  // replayed to a reconnecting client" — and while it was missing from this
  // set it was all four of those things, because the mutation branch is the
  // fall-through.
  //
  // The client publishes it on every pan or zoom, throttled to 10 Hz, so ~26
  // seconds of one editor navigating filled all 256 slots of the catch-up log
  // with camera positions and pushed `floor` past every real mutation. The
  // next peer whose socket blipped then failed the `lastSeq + 1 >= floor`
  // check and was sent `resync`, re-hydrating every loaded tab from D1 —
  // exactly the storm the comment below this block says was hunted down once
  // already, reopened by somebody merely scrolling. It also cost a
  // `storage.put` per frame, 10 a second per navigating editor.
  //
  // And because the role gate drops any non-presence op from a view-role
  // sender, a view-only visitor could not be FOLLOWED at all, contradicting
  // docs/specs/012-collaboration/follow-me-viewport.md's "the audience on a view link is exactly who most needs it".
  'viewport',
  // A dragger's preview (docs/specs/008-canvas/drag-preview.md): where the elements they are moving are
  // right now, at cursor rates, writing nothing; the real change follows on release as element ops.
  // The room relays it only from an editor (receivers check too): a viewer must never make others'
  // elements appear to move.
  'drag-preview',
  // Who is on which layer of a photo page (docs/specs/031-photo/photo-pages.md "Collaboration"): the layer the
  // sender has active, so the Layers tab shows their avatar on it. Ephemeral, never logged, from any session
  // (only someone who may edit the photo says one).
  'photo-presence',
  // Who the sender is following (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"). The room
  // keeps it on the session and is the only one who reads it: it tells each person, on their own socket, who
  // follows them (`followers`). Never relayed, from any session (a viewer follows too).
  'follow',
] as const;

// Room op kinds that DO change the document: they get a monotonic `seq` within
// the room's epoch, land in the bounded catch-up log so a reconnecting peer can
// replay them (docs/specs/012-collaboration/realtime-conflict-resolution.md), and are refused from a view-role sender.
export const MUTATION_OP_KINDS = [
  'tab',
  'tab-meta',
  'el',
  // One checklist tick or comment change on one element (docs/specs/012-collaboration/collab-race-hardening.md).
  'el-delta',
  'document-meta',
  // One photo page's layers changing, layer by layer (docs/specs/031-photo/photo-store.md "Live
  // sync"): two people changing different layers both keep their changes.
  'photo',
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
// `document-trashed` (docs/specs/013-workspace/trash.md): the document went to the
// Trash, so every session ends with the deleted state. A forged one would end
// everyone's session.
//
// `changeset` (docs/specs/024-agents/agent-changesets.md): one write the api applied and recorded,
// sequenced through /mutation. A forged one would show people a change nobody made (CS24).
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'document-trashed',
  'changeset',
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

export function isSystemOpKind(kind: unknown): kind is (typeof SYSTEM_OP_KINDS)[number] {
  return typeof kind === 'string' && (SYSTEM_OP_KINDS as readonly string[]).includes(kind);
}

// ---------------------------------------------------------------------
// Freeing a held element (docs/specs/007-editor/live-app.md)
// ---------------------------------------------------------------------

// Free an element somebody else is holding through the concurrent-selection lock, so the room can get on. A
// MESSAGE to the room rather than a relayed op: relayed, it would be a command any peer could issue against any
// other; the room alone knows which socket holds what. It keeps the `facilitator` frame it once shared with the
// facilitator baton.
//
// `target` is the holder's presence id, `elementId` what they are holding.
export type FacilitatorAction = { action: 'unlock'; target: string; elementId: string };

// Outgoing WebSocket frames the room sends to clients.
// `presence` is the full participant list refreshed on join / leave;
// `op` is an arbitrary document change rebroadcast from another client.
// `op` is intentionally `unknown` so the room itself stays agnostic
// of the client's op union — clients narrow it via their own
// `RoomOp` type and ignore frames they don't recognise.
export type ServerMessage =
  // `agents`: agent presence, apart from `participants` so no session reader counts one (agent-presence PR14).
  | { kind: 'presence'; participants: ParticipantPresence[]; agents: AgentPresence[] }
  // `seq`/`epoch` ride mutation ops only (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): the room
  // assigns each mutation a monotonic sequence within an `epoch` (a random
  // id minted per DO instantiation) so a reconnecting client can ask what
  // it missed. Presence ops (cursor/select/laser/tab-focus) carry neither —
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
  // "Your hold on this element has been released" (docs/specs/007-editor/live-app.md), sent
  // to the HOLDER'S SOCKET ALONE. Being sent it is the whole of the addressing:
  // the room mints a presence id per socket and never tells a client which one
  // is its own (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast carrying a target id would reach
  // nobody able to recognise themselves in it.
  //
  // The receiver drops the selection and re-broadcasts its own `select` op, so
  // every other peer's lock clears through the ordinary path and the room needs
  // to tell nobody else anything.
  | { kind: 'selection-released'; elementId: string; by: string }
  // Who is following you (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"): their presence
  // ids, sent to YOUR SOCKET ALONE whenever the list changes, the same addressing as `selection-released`. It is
  // how a client counts its followers and refuses to follow one of them back.
  | { kind: 'followers'; ids: string[] }
  // The ordering cursor this session has reached (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1), sent on
  // `hello` and to the SENDER of each ordered op, which the relay skips. Without
  // it a client only learned seqs from other people's ops, so a reconnect
  // replayed its own ops back at it (and, having heard nothing, the whole log).
  // Harmless for idempotent element ops; an `el-delta` op is a change, so every
  // replayed tick was applied twice.
  | CursorMessage
  | FormatMessage;

// `ref`: the `ref` the sender put on the op this frame answers, echoed so the sender knows that op is
// sequenced (docs/specs/012-collaboration/collab-race-hardening.md phase 6). Absent on hello.
export type CursorMessage = { kind: 'cursor'; epoch: string; seq: number; ref?: number };

// A `ref` the room echoes: a positive safe integer, nothing else.
export function isRoomOpRef(ref: unknown): ref is number {
  return typeof ref === 'number' && Number.isSafeInteger(ref) && ref > 0;
}

// The server's document format number (docs/specs/016-platform/new-version-prompt.md), sent to
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
  // Ask the room to free an element somebody else holds (FacilitatorAction).
  | ({ kind: 'facilitator' } & FacilitatorAction)
  // Sent right after re-connecting (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): "here's the last
  // epoch+seq I applied — tell me what I missed, or that I must re-hydrate".
  // `epoch` is null on a client that hasn't seen an ordered op yet.
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  // An identity update over an open socket (docs/specs/014-identity/profile-picture.md §4): the
  // same participant fields as `hello`, re-read by the same rules, without re-joining. Today it
  // carries a profile picture switched on or off. Ignored before the session's hello.
  | { kind: 'identity'; participant: ParticipantPresence };

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
  | { kind: 'tab'; tabId: string; tab: Tab }
  // A single element on a tab changed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0): add / update /
  // remove / reorder, applied by id so a peer editing a DIFFERENT element
  // on the same tab merges instead of overwriting the whole tab. `op`
  // carries the element payload (see @livedesign/document ElementOp).
  | { kind: 'el'; tabId: string; op: RoomElementOp }
  // A tab's non-element metadata changed (name, background, font, …) —
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  //
  // `clear` names fields the sender REMOVED (a reset background). A removed field serialises to nothing inside `patch`, so it
  // used to force a whole-`tab` op, which replaced every element on every
  // receiver and wiped their unsaved presses (docs/specs/012-collaboration/collab-race-hardening.md).
  | {
      kind: 'tab-meta';
      tabId: string;
      patch: Partial<Omit<Tab, 'elements'>>;
      clear?: string[];
    }
  // ONE change to a field many people write at once: a checklist tick, a comment
  // (docs/specs/012-collaboration/collab-race-hardening.md). It carries the CHANGE rather than the state: a
  // whole-element `el` update replaced a peer's copy with the sender's snapshot, so two people pressing the same
  // done check lost a mark.
  | { kind: 'el-delta'; tabId: string; elementId: string; delta: ElementDelta }
  // A photo page's picture changed (docs/specs/031-photo/photo-store.md "Live sync"): its ops,
  // applied by layer id, or the whole photo gone (`removed`). `Tab.photos` never rides a `tab-meta`
  // patch, which would replace every photo wholesale.
  | { kind: 'photo'; tabId: string; pageId: string; ops: PhotoOp[] }
  | { kind: 'photo'; tabId: string; pageId: string; removed: true }
  // Document-level metadata changed: rename, tab reorder, tab add /
  // delete. Carries the new ordered list of tab summaries (id + name
  // + order) so receivers can update the TabBar without fetching the
  // full tab payloads.
  | {
      kind: 'document-meta';
      name: string;
      // `folder` (docs/specs/006-document/tab-folders.md) is the per-document folder name, optional so
      // an older peer that omits it is treated as loose — no parse break.
      // `outOfScope` marks a tab outside a tab-scoped session's scope
      // (docs/specs/013-workspace/tab-scoped-share-links.md): its name is blanked by the room.
      tabs: { id: string; name: string; orderIndex: number; folder?: string; outOfScope?: true }[];
    }
  // `tabId` scopes the selection to the tab it lives on: element ids
  // are only unique per tab in older documents (tab duplication used to
  // copy ids verbatim), so an unscoped selection rendered — and, via
  // the docs/specs/007-editor/live-app.md concurrent-selection lock, LOCKED — the same-id element
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
  // One sample of the sender's laser-pointer trail (canvas-coords).
  // Sent on every pointer move while the sender is in laser tool
  // mode, throttled like cursor. Receivers append to a per-
  // participant buffer and fade the trail out over ~1 s — see
  // LaserOverlay. The active tab id scopes the rendering so peers on
  // a different tab don't see the laser.
  | {
      kind: 'laser';
      tabId: string;
      x: number;
      y: number;
      // The sender's pen (docs/specs/008-canvas/laser-panel.md): width / colour / trail / effect, each a
      // preset token. Optional, so a packet from an older client still parses
      // and simply draws the original laser. It rides the sample rather than a
      // separate op because a second packet would need ordering against the
      // samples it describes, for a couple of dozen bytes on a frame that is
      // already throttled to ~30 Hz. Receivers parse it field by field.
      look?: {
        width: 'fine' | 'medium' | 'bold';
        // 'presence', a standard colour's name ('red', 'grey'...) or a custom '#rrggbb'
        // (docs/specs/004-interface-design/colour-picker.md); older clients sent
        // 'cyan' and 'white', which receivers read as 'teal' and 'ink'.
        colour: string;
        trail: 'quick' | 'normal' | 'long';
        effect: 'beam' | 'glow' | 'comet' | 'spark';
      };
    }
  // A dragger's live preview (docs/specs/008-canvas/drag-preview.md): one geometry patch per changed
  // element; `end` says the preview is over, `landed` that it was written (the real change follows as
  // element ops, after the autosave's wait), so receivers keep drawing it until then.
  | { kind: 'drag-preview'; tabId: string; patches?: DragPreviewPatch[]; end?: true; landed?: true }
  // The layer the sender has active on a photo page (docs/specs/031-photo/photo-pages.md "Collaboration"), or
  // none (layerId null). Presence: relayed as is, never stored.
  | { kind: 'photo-presence'; tabId: string; pageId: string; layerId: string | null }
  // The sender's VIEWPORT (docs/specs/012-collaboration/follow-me-viewport.md): where they are looking, so anyone who
  // has chosen to follow them can mirror it. Ephemeral presence exactly like
  // cursor / laser: throttled, never logged, never ordered (no
  // `seq`), never replayed to a reconnecting client.
  //
  // Sent by everyone on change rather than on request. The alternative — a
  // follower asks, the presenter starts publishing — needs a second op kind, a
  // re-request on every reconnect, and a rule for what happens when the
  // presenter reloads mid-follow, all for three numbers on an
  // already-throttled channel. The cost is accepted and written down: a room
  // where nobody follows anybody still carries these while people scroll.
  //
  // `size` is the sender's canvas. Optional: a client from before it sends
  // none, and a viewport without one counts as unknown.
  | {
      kind: 'viewport';
      tabId: string;
      pan: { x: number; y: number };
      zoom: number;
      size?: { width: number; height: number };
    }
  // Who the sender follows (a presence id), or null when they stop: to the room, never relayed.
  | { kind: 'follow'; target: string | null }
  // A share link was revoked by the document owner. Every connected
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
  // The document went to the Trash (docs/specs/013-workspace/trash.md). Every
  // session shows the deleted state; the room then closes every socket (4004).
  // Worker-originated, like share-revoked.
  | { kind: 'document-trashed' };

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown` — the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | { kind: 'hello'; participant: ParticipantPresence }
  | { kind: 'op'; op: RoomOp; ref?: number }
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | { kind: 'identity'; participant: ParticipantPresence }
  | ({ kind: 'facilitator' } & FacilitatorAction);

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
  // Addressed by being sent at all — see ServerMessage above.
  | { kind: 'selection-released'; elementId: string; by: string }
  | { kind: 'followers'; ids: string[] }
  | CursorMessage
  | FormatMessage;

// The WebSocket close code the realtime room ends a session with when an access
// change narrows who may be in it without revoking a link (docs/specs/015-api/api.md
// "Access changes end the sessions they affect"): a share password set, or a
// member leaving their team. Beside 4003 (a share link changed) and 4004 (the
// document was trashed). The editor reloads into the ordinary access path.
export const ACCESS_CHANGED_CLOSE = 4005;

// The close code for a workbench session whose pairing or token ended (docs/specs/013-workspace/workbench-embeds.md):
// the page turns read-only and does not reconnect.
export const WORKBENCH_ENDED_CLOSE = 4006;

// The room's keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"): the client sends
// the bare text ROOM_PING on an idle socket and the room answers ROOM_PONG without waking from hibernation
// (setWebSocketAutoResponse). Plain text, never JSON, so neither side's message handler ever sees them as ops.
export const ROOM_PING = 'ping';
export const ROOM_PONG = 'pong';
