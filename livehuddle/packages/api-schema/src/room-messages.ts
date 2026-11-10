import type { TabConnectionWire } from '@liveworkspace/api-schema/tab-connection';
import type { AgentPresence } from '@liveworkspace/api-schema/agent-presence';
import type { OpRefusedMessage } from '@liveworkspace/api-schema/room-refusal';
import type { CollabKeyMessage } from '@liveworkspace/api-schema/collab-key';
import type { ElementDelta, RoomElementOp, Tab } from '@livehuddle/document';
import type { ParticipantPresence } from './index';
import type { AvatarOp, AvatarPushOp } from '@livehuddle/avatar/wire';
import type { AvatarSayOp } from '@livehuddle/avatar/wire-say';
import type { AvatarVoiceOp, CallsCheckOp, CallTrackOp } from './call-voice';
import type { AvatarHandOp, AvatarLetSpeakOp } from './call-hand';
import type { CallSessionOp, CallStopShareOp } from './call-control';
import type { AvatarKnockAnswerOp, AvatarKnockOp } from './knock';
import type { AvatarBellOp } from './bell';
import type { NudgeOp, NudgeRefusedOp } from './nudge';
import type { GameEventOp, GameInputOp } from './table-game';
import type { CallsModeOp } from './calls-mode';
import type { PresenceBatchMessage } from '@liveworkspace/api-schema/presence-fanout';
import type { DragPreviewPatch, DragPreviewRide } from './drag-preview';
import type { ChangesetRoomOp } from './changesets';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// One participant's Avatar-mode character and its statuses (docs/specs/008-canvas/avatar-mode.md) are Avatar mode's
// wire shapes, in @livehuddle/avatar/wire; re-exported so this package's surface is unchanged.
export { AVATAR_STATUS_IDS, expandAvatarPacket, isLeanAvatarPacket } from '@livehuddle/avatar/wire';
export type { AvatarPacket, AvatarPresence, AvatarStatus } from '@livehuddle/avatar/wire';

// Room op kinds that are ephemeral signals: they mutate no document state,
// so they relay unordered (no seq) and from any role.
//
// `avatar` (docs/specs/008-canvas/avatar-mode.md) is presence in the plainest sense: someone's walking
// character, at cursor rates, mutating nothing. View-role senders included —
// an audience member walking around a document they were shown a link to is
// the same kind of harmless as their cursor.
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
  'tab-focus',
  'avatar',
  // A shove (docs/specs/008-canvas/avatar-mode.md) moves nothing on the server and nothing in the
  // document — it asks one peer to step aside. Same trust level as `avatar`.
  'avatar-push',
  // A character saying something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): a message that floats
  // away in seconds, so nothing to order, log or replay. The room relays it from an Editor or a Participant only.
  'avatar-say',
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire"): how loudly a walker is talking, a
  // sample like `avatar`, and where to ask for their microphone. Neither carries audio, neither is worth replaying,
  // and the room relays both from an Editor or a Participant only.
  'avatar-voice',
  'call-track',
  // A silent publishing call's nudge for the room to read the calls kill switch (docs/specs/016-platform/
  // calls-kill-switch.md "The room tells its clients"): consumed by the room, never relayed, never logged.
  'calls-check',
  // Raise hand (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"): a stage's audience asking to
  // speak, and a speaker letting them, both about a moment, so never ordered, logged or replayed. From an Editor or
  // a Participant only; a let-speak is ADDRESSED to the hand's owner, as a shove is.
  'avatar-hand',
  'avatar-let-speak',
  // A call proving its Realtime session to the room (proximity-audio.md "The wire"), so the mint route can ask the room
  // who may hear whom: consumed by the room, never relayed, from any level. And an Editor asking someone to stop their
  // screen share (video-and-screen-bubbles.md "Share roles"): ADDRESSED to the sharer, as a let-speak is.
  'call-session',
  'call-stop-share',
  // A knock on a room and its answer (docs/specs/012-collaboration/knock.md): a moment, from any level, never ordered,
  // logged or replayed. A knock is broadcast and each receiver checks it stands inside; an answer is ADDRESSED to the
  // knocker, as a shove is.
  'avatar-knock',
  'avatar-knock-answer',
  // A ring of a Reception Desk's bell (docs/specs/009-elements/workday-pieces.md "The wire"): a moment, from any level,
  // broadcast like a knock; each receiver checks it stands in earshot.
  'avatar-bell',
  // A nudge from the Collaborators list (docs/specs/012-collaboration/nudge.md "The wire"): a moment, ADDRESSED to its
  // target alone as a shove is, from an Editor or a Participant; the room holds each pair to one per 2 minutes.
  'nudge',
  // A game at a piece (docs/specs/009-elements/social-pieces.md "Ping-Pong Table", "The wire"): a player's paddle, a
  // sample at most 20 a second, and a moment of the game (a serve, a strike, a miss), sent by the player whose moment
  // it is. Neither is worth ordering, logging or replaying: a reconnect misses moments, never the document. The room
  // relays both from an Editor or a Participant only; a Viewer watches.
  'game-input',
  'game-event',
  // Where the sender is looking, for anyone following them (docs/specs/012-collaboration/follow-me-viewport.md). Its
  // own wire contract calls it "ephemeral presence exactly like cursor /
  // laser / avatar: throttled, never logged, never ordered (no `seq`), never
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
  // "Come and look at this" (docs/specs/012-collaboration/bring-focus.md). Ephemeral for the same reason a laser
  // is: a request to look somewhere is about a moment, and one replayed to a
  // late joiner is answering a sentence nobody is still saying.
  'focus-here',
  // A dragger's preview (docs/specs/008-canvas/drag-preview.md): where the elements they are moving are
  // right now, at cursor rates, writing nothing; the real change follows on release as element ops.
  // The room relays it only from an editor (receivers check too): a viewer must never make others'
  // elements appear to move.
  'drag-preview',
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
  // One checklist tick or comment change on one element
  // (docs/specs/012-collaboration/collab-race-hardening.md).
  'el-delta',
  'document-meta',
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
//
// `calls-mode` (docs/specs/016-platform/calls-kill-switch.md "The room tells its clients"): the room's own word that
// the calls kill switch changed. A forged one would end everyone's call.
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'document-trashed',
  'changeset',
  'calls-mode',
  // The room refusing a nudge sent inside its 2 minutes (docs/specs/012-collaboration/nudge.md "The wire"), to the
  // sender alone: a client forging one could start someone's countdown, so none is relayed from a client.
  'nudge-refused',
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

// Op kinds of features livehuddle no longer has, which an older client may still send: the Vote's one-dot `vote`
// op (docs/specs/002-project-scope/not-in-livehuddle.md "The Vote"), and the laser's trail and a Reaction Pad's
// burst (docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools, Isometric and Zen"). The wire carries an op as `unknown`, so one
// still parses; the room drops it at its op gate, so it is never sequenced, relayed, logged for catch-up or noted
// in the collaboration ledger. Kept out of ROOM_OP_KINDS: nothing sends or handles one now.
export const RETIRED_OP_KINDS = ['vote', 'laser', 'reaction'] as const;

export function isRetiredOpKind(kind: unknown): boolean {
  return typeof kind === 'string' && (RETIRED_OP_KINDS as readonly string[]).includes(kind);
}

// Membership test for the room's ordering + role gate. Takes a loose string
// because it reads `op.kind` off an `unknown` wire payload (see ServerMessage
// below on why the op itself stays untyped).
export function isMutationOpKind(kind: unknown): kind is (typeof MUTATION_OP_KINDS)[number] {
  return typeof kind === 'string' && (MUTATION_OP_KINDS as readonly string[]).includes(kind);
}

export function isPresenceOpKind(kind: unknown): kind is PresenceOpKind {
  return typeof kind === 'string' && (PRESENCE_OP_KINDS as readonly string[]).includes(kind);
}

// A participation act (docs/specs/013-workspace/share-roles.md "Integrity"): a comment reaction
// (docs/specs/012-collaboration/comment-reactions.md): whoever may comment may react, and the room writes a
// Participant's reactions as it writes its answers; and a notice board pin or unpin
// (docs/specs/009-elements/social-pieces.md "Notice Board"), which the room writes the same way, and a Timer's or
// Stopwatch's press (docs/specs/009-elements/timer-and-stopwatch.md "Share roles"), and an Arcade Machine score
// (docs/specs/009-elements/social-pieces.md "High Scores"; its clear is an Editor's). A Participant's
// socket may send these beside presence; every other mutation from it is dropped, except an `el` op, which the room
// applies through the participant content rule instead of relaying.
const PARTICIPATION_DELTA_KINDS = [
  'comment-react',
  'notice-pin',
  'notice-unpin',
  'piece-timer',
  'arcade-score',
] as const;

export function isParticipationOp(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const { kind, delta } = op as { kind?: unknown; delta?: unknown };
  if (kind !== 'el-delta' || typeof delta !== 'object' || delta === null) return false;
  return (PARTICIPATION_DELTA_KINDS as readonly unknown[]).includes(
    (delta as { kind?: unknown }).kind,
  );
}

export function isSystemOpKind(kind: unknown): kind is (typeof SYSTEM_OP_KINDS)[number] {
  return typeof kind === 'string' && (SYSTEM_OP_KINDS as readonly string[]).includes(kind);
}

// ---------------------------------------------------------------------
// Facilitator (docs/specs/012-collaboration/facilitator.md)
// ---------------------------------------------------------------------

// Why this is a MESSAGE and not a room op: an op is relayed, and the baton is
// arbitrated. Only the room can say who holds it, because only the room can see
// every socket, and only the room can mint a token no other peer ever receives.
// A relayed "I am the facilitator now" would be a claim anybody could make.

/** What moved the baton, which is what lets each client word its own toast. */
export type FacilitatorReason =
  // Somebody took a free baton.
  | 'claim'
  // Somebody handed it to somebody else (or the owner took it back).
  | 'grant'
  // The holder stepped down.
  | 'release'
  // The holder left and did not come back inside the grace period.
  | 'left'
  // The state a joiner is told on connect. Announces nothing: the room is
  // catching them up, not reporting an event.
  | 'state';

export type FacilitatorAction =
  // Take a free baton (or, as the owner, take a held one).
  | { action: 'claim' }
  // Hand it to a presence id: the owner, or the holder passing it on.
  | { action: 'grant'; to: string }
  // Step down.
  | { action: 'release' }
  // Free an element somebody else is holding through the concurrent-selection
  // lock (docs/specs/007-editor/editor-app.md), so the room can get on. USING the baton rather than moving
  // it, but it rides the same arbitrated channel for the same reason the
  // others do: relayed, it would be a command any peer could issue against any
  // other, and the point is that only the person running the session can.
  //
  // `target` is the holder's presence id, `elementId` what they are holding.
  | { action: 'unlock'; target: string; elementId: string };

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
  // Who holds the facilitator baton (docs/specs/012-collaboration/facilitator.md), broadcast on every change and
  // sent once to each joiner with `reason: 'state'`.
  //
  // `token` rides ONLY the copy sent to the new holder, and is the whole
  // security model: the room knows no identities (docs/specs/015-api/public-api-and-tokens.md §6), so the holder
  // proves itself by presenting the token on its next `hello` rather than by
  // being anybody in particular. A refresh therefore keeps the baton, and no
  // other peer can claim it, because no other peer was ever sent it.
  | {
      kind: 'facilitator';
      holder: string | null;
      by?: string;
      reason: FacilitatorReason;
      token?: string;
    }
  // "Your hold on this element has been released" (docs/specs/007-editor/editor-app.md + docs/specs/012-collaboration/facilitator.md), sent
  // to the HOLDER'S SOCKET ALONE. Being sent it is the whole of the addressing:
  // the room mints a presence id per socket and never tells a client which one
  // is its own (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast carrying a target id would reach
  // nobody able to recognise themselves in it. Same trick as the baton token.
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
  // Harmless for idempotent element ops; a delta op (a tick, a comment) is
  // not, so every replayed delta was counted twice.
  | CursorMessage
  | FormatMessage
  | GrantRenewMessage
  // An element op the room refused (docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element").
  // The session's own collab key, to its socket alone (docs/specs/013-workspace/share-roles.md "The collab key").
  | CollabKeyMessage
  | OpRefusedMessage;

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
// `leanAvatars`: the room takes lean avatar packets and fills them back out for an older editor
// (docs/specs/015-api/api.md "A busy room bounds its presence fan-out"); an editor sends them only when it says so.
export type FormatMessage = {
  kind: 'format';
  format: number;
  build?: string;
  leanAvatars?: boolean;
};

// Incoming WebSocket frames clients send to the room.
// `hello` identifies the participant on connect; `op` is any local
// mutation the client wants rebroadcast to peers.
export type ClientMessage =
  // `facilitatorToken` (docs/specs/012-collaboration/facilitator.md) is the baton coming home after a refresh:
  // the room checks it against the one it issued and, if it still matches,
  // hands the baton to this new socket. Absent on every ordinary hello.
  // `batches`: this editor takes a busy room's coalesced `batch` frames (docs/specs/015-api/api.md "A busy room
  // bounds its presence fan-out"); a room never sends one to a session that did not say so.
  // `leanAvatars`: this editor reads lean avatar packets (AvatarPacket), filling in the costume it last saw; a room
  // fills them back out for a session that did not say so.
  | {
      kind: 'hello';
      participant: ParticipantPresence;
      facilitatorToken?: string;
      batches?: boolean;
      leanAvatars?: boolean;
    }
  // `ref`: asks the room to echo it on this op's `cursor` frame (CursorMessage).
  | { kind: 'op'; op: unknown; ref?: number }
  // Ask the room to move the baton (docs/specs/012-collaboration/facilitator.md). The room decides; the client
  // learns the answer from the `facilitator` frame like everybody else.
  | ({ kind: 'facilitator' } & FacilitatorAction)
  // Sent right after re-connecting (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): "here's the last
  // epoch+seq I applied — tell me what I missed, or that I must re-hydrate".
  // `epoch` is null on a client that hasn't seen an ordered op yet.
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | GrantMessage;

// The session's grant is about to lapse (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): the room asks
// for a fresh one ROOM_GRANT_ASK_BEFORE_MS before it does, and drops the socket (GRANT_LAPSED_CLOSE) when none
// came by then. `expiresAt`: when the session's grant runs out, epoch ms.
export type GrantRenewMessage = { kind: 'grant-renew'; expiresAt: number };

// A fresh grant for this session, the index's ES256 JWT (or the api's room ticket, for a client that has no
// grant of its own). The room checks it as it checked the first, and keeps the session to what it now allows.
export type GrantMessage = { kind: 'grant'; grant: string };

// How long before a session's grant lapses the room asks for a new one. The editor renews on its own a minute
// before expiry, so the ask is the fallback; 30 s leaves a slow renewal room to land.
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
  | { kind: 'tab'; tabId: string; tab: Tab }
  // A single element on a tab changed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0): add / update /
  // remove / reorder, applied by id so a peer editing a DIFFERENT element
  // on the same tab merges instead of overwriting the whole tab. `op`
  // carries the element payload (see @livehuddle/document ElementOp).
  | { kind: 'el'; tabId: string; op: RoomElementOp }
  // A tab's non-element metadata changed (name, background, font, …) —
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  //
  // `clear` names fields the sender REMOVED (Clear Timer, a reset
  // background). A removed field serialises to nothing inside `patch`, so it
  // used to force a whole-`tab` op, which replaced every element on every
  // receiver and wiped their unsaved presses (docs/specs/012-collaboration/collab-race-hardening.md).
  | {
      kind: 'tab-meta';
      tabId: string;
      patch: Partial<Omit<Tab, 'elements'>>;
      clear?: string[];
    }
  // ONE change to a field many people write at once: a checklist tick, a
  // comment (docs/specs/012-collaboration/collab-race-hardening.md): a whole-element `el` update replaced a peer's copy with the
  // sender's snapshot, so two people ticking the same checklist row lost a mark.
  | { kind: 'el-delta'; tabId: string; elementId: string; delta: ElementDelta }
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
      // `connection`: a connected tab's (liveworkspace/docs/specs/004-index/connected-tabs.md), as the room sends when
      // the index adds one (the reverse tab of a connection made both ways).
      tabs: {
        id: string;
        name: string;
        orderIndex: number;
        folder?: string;
        outOfScope?: true;
        connection?: TabConnectionWire;
      }[];
    }
  // `tabId` scopes the selection to the tab it lives on: element ids
  // are only unique per tab in older documents (tab duplication used to
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
  // The sender's Avatar-mode character, and one character SHOVING another (docs/specs/008-canvas/avatar-mode.md):
  // Avatar mode's wire shapes, in @livehuddle/avatar/wire.
  | AvatarOp
  | AvatarPushOp
  | AvatarSayOp
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire").
  | AvatarVoiceOp
  | CallTrackOp
  | CallsCheckOp
  // Raise hand and Let Speak (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand").
  | AvatarHandOp
  | AvatarLetSpeakOp
  | CallSessionOp
  | CallStopShareOp
  | AvatarKnockOp
  | AvatarKnockAnswerOp
  | AvatarBellOp
  | NudgeOp
  | NudgeRefusedOp
  // A game at a piece (docs/specs/009-elements/social-pieces.md "The wire").
  | GameInputOp
  | GameEventOp
  // The calls kill switch changed (docs/specs/016-platform/calls-kill-switch.md): system only, from the room.
  | CallsModeOp
  // A dragger's live preview (docs/specs/008-canvas/drag-preview.md): one geometry patch per changed
  // element, or for a very large move one shared offset (`ride`, in place of `patches`, so an editor that
  // does not know it drops the op and sees the move on release); `end` says the preview is over, `landed`
  // that it was written (the real change follows as element ops, after the autosave's wait), so receivers
  // keep drawing it until then.
  | {
      kind: 'drag-preview';
      tabId: string;
      patches?: DragPreviewPatch[];
      ride?: DragPreviewRide;
      end?: true;
      landed?: true;
    }
  // The sender's VIEWPORT (docs/specs/012-collaboration/follow-me-viewport.md): where they are looking, so anyone who
  // has chosen to follow them can mirror it. Ephemeral presence exactly like
  // cursor / laser / avatar: throttled, never logged, never ordered (no
  // `seq`), never replayed to a reconnecting client.
  //
  // Sent by everyone on change rather than on request. The alternative — a
  // follower asks, the presenter starts publishing — needs a second op kind, a
  // re-request on every reconnect, and a rule for what happens when the
  // presenter reloads mid-follow, all for three numbers on an
  // already-throttled channel. The cost is accepted and written down: a room
  // where nobody follows anybody still carries these while people scroll.
  //
  // `size` is the sender's canvas, so Bring Focus can tell a presser whether
  // the room is already looking at a point on each viewer's own screen
  // (docs/specs/012-collaboration/bring-focus.md). Optional: a client from before it
  // sends none, and a viewport without one counts as unknown.
  | {
      kind: 'viewport';
      tabId: string;
      pan: { x: number; y: number };
      zoom: number;
      size?: { width: number; height: number };
    }
  // Who the sender follows (a presence id), or null when they stop: to the room, never relayed.
  | { kind: 'follow'; target: string | null }
  // --- Bring Focus (docs/specs/012-collaboration/bring-focus.md) ----------------------------------------
  // Somebody pressed a Bring Focus element: offer everyone else a jump to it.
  //
  // Carries the element's CENTRE, not the presser's pan. Two people rarely
  // have the same window size, so copying a pan lands the element off-centre
  // (or off-screen) for anyone whose canvas is a different shape; centring the
  // point is the correct translation of "come and look at this". The
  // presser's `zoom` still rides along for clients from before receivers kept
  // their own zoom; a receiver ignores it.
  //
  // No sender name: the envelope already identifies the sender and the
  // receiver resolves the name from the presence list it holds, so a renamed
  // participant's invitation reads correctly.
  | { kind: 'focus-here'; tabId: string; at: { x: number; y: number }; zoom: number }
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
  | {
      kind: 'hello';
      participant: ParticipantPresence;
      facilitatorToken?: string;
      batches?: boolean;
      leanAvatars?: boolean;
    }
  | { kind: 'op'; op: RoomOp; ref?: number }
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | ({ kind: 'facilitator' } & FacilitatorAction)
  | GrantMessage;

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
  | {
      kind: 'facilitator';
      holder: string | null;
      by?: string;
      reason: FacilitatorReason;
      token?: string;
    }
  // Addressed by being sent at all — see ServerMessage above.
  | { kind: 'selection-released'; elementId: string; by: string }
  | { kind: 'followers'; ids: string[] }
  | CursorMessage
  | FormatMessage
  | GrantRenewMessage
  // An element op the room refused (docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element").
  | CollabKeyMessage
  | OpRefusedMessage
  // A busy room's samples, coalesced for one step (docs/specs/015-api/api.md "A busy room bounds its presence
  // fan-out"): each the op frame it would have sent alone, in order.
  | PresenceBatchMessage<{ kind: 'op'; from: string; op: RoomOp }>;

// The WebSocket close code the realtime room ends a session with when an access
// change narrows who may be in it without revoking a link (docs/specs/015-api/api.md
// "Access changes end the sessions they affect"): a share password set, or a
// member leaving their team. Beside 4003 (a share link changed) and 4004 (the
// document was trashed). The editor reloads into the ordinary access path.
export const ACCESS_CHANGED_CLOSE = 4005;

// The room's keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"): the client sends
// the bare text ROOM_PING on an idle socket and the room answers ROOM_PONG without waking from hibernation
// (setWebSocketAutoResponse). Plain text, never JSON, so neither side's message handler ever sees them as ops.
// The close code for a session whose grant lapsed without a fresh one (GrantRenewMessage): the editor fetches a
// new grant and reconnects.
export const GRANT_LAPSED_CLOSE = 4007;

// A room's capacity and the close an over-capacity join gets (docs/specs/015-api/api.md "A room holds at most
// 100 connections"), one number for every product's room.
export {
  ROOM_FULL_CLOSE,
  ROOM_FULL_MESSAGE,
  ROOM_FULL_REASON,
  ROOM_FULL_RETRY_MS,
  ROOM_MAX_CONNECTIONS,
  roomIsFull,
} from '@liveworkspace/api-schema/room-capacity';

// How a busy room paces its sample streams (docs/specs/015-api/api.md "A busy room bounds its presence fan-out"),
// one table for every product's room.
export {
  PRESENCE_QUIET_ROOM,
  presenceBatches,
  presenceStepMs,
} from '@liveworkspace/api-schema/presence-fanout';

export const ROOM_PING = 'ping';
export const ROOM_PONG = 'pong';
