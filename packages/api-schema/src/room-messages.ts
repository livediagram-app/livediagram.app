import type { AgentPresence } from './agent-presence';
import type { ArticleOp, ElementDelta, ElementOp, QaNote, Tab } from '@livediagram/document';
import type { ParticipantPresence } from './index';
import type { AvatarConfig } from './avatar';
import type { LivePoll } from './poll';
import type { DragPreviewPatch } from './drag-preview';
import type { ChangesetRoomOp } from './changesets';
import type { ItemsRoomOp, ItemTypesRoomOp } from './items';
import type { SheetsRoomOp } from './sheets';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// One participant's Avatar-mode character (docs/specs/008-canvas/avatar-mode.md), as it travels over the
// presence channel. Position is the character's FEET in canvas coords; the
// animation inputs and the costume ride along so a peer draws the same
// character, walk cycle, hop, and flag wave the sender sees. Deliberately
// small — this goes out at cursor rates.

export type AvatarPresence = {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  // The sender's costume (docs/specs/008-canvas/avatar-mode.md): gender / clothing / hair / size, each a
  // preset token from a closed set. Optional so a packet from an older client
  // still parses — the receiver falls back to the default character. Purely
  // cosmetic, and never an identity claim.
  config?: AvatarConfig;
  // A reaction in progress (docs/specs/008-canvas/avatar-mode.md): which one, and how far into it the
  // sender is. The pose is derived from these two by a pure function on both
  // ends, so the wire carries a kind and a clock rather than a pose.
  reaction?: {
    kind: 'jumping-jacks' | 'wave' | 'spin' | 'cheer' | 'dance';
    elapsedMs: number;
  };
  walking: boolean;
  // Two-frame leg swing (0 | 1).
  stepFrame: number;
  // Height above the ground mid-hop, in canvas px (0 = standing).
  lift: number;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
  // Chair (docs/specs/009-elements/chair.md): the element id of the chair this character is sitting
  // on, or null / absent when standing.
  //
  // Occupancy rides HERE, on ephemeral presence, and is deliberately never
  // written to the document: a chair therefore cannot be left permanently
  // occupied by somebody who closed their laptop, cannot conflict between two
  // clients, and reaches D1 and undo not at all. Optional so a
  // packet from an older client still parses as "standing".
  seatedOn?: string | null;
};

// Room op kinds that are ephemeral signals: they mutate no document state,
// so they relay unordered (no seq) and from any role.
//
// `poll-answer` (docs/specs/012-collaboration/live-poll.md) is here for the ROLE half rather than the
// presence half: answering a poll changes nothing on the document, and a
// presenter pulse-checking an audience on a view link is the main thing
// polls are for, so a view-role participant must be able to send one.
// `poll-start` / `poll-end` are deliberately NOT here — they stay behind
// the edit-role gate below, so an audience member can answer a poll but
// can't start one or end someone else's.
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
  'laser',
  'tab-focus',
  'poll-answer',
  'avatar',
  // A shove (docs/specs/008-canvas/avatar-mode.md) moves nothing on the server and nothing in the
  // document — it asks one peer to step aside. Same trust level as `avatar`.
  'avatar-push',
  // A reaction burst (docs/specs/009-elements/reaction-pad.md) is pure theatre: nothing on the server,
  // nothing in the document, and nothing worth replaying to somebody who
  // arrives after it finished.
  'reaction',
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
  // Where someone is writing in an article (docs/specs/007-editor/article-pages.md "Collaboration"):
  // their caret, as a block id and a character offset, at cursor rates, writing nothing. From any
  // session, like the cursor: a viewer's writing takes no caret, so a viewer never sends one.
  'article-caret',
  // Whose hands are on a Plan board's card (docs/specs/026-plan/plan-board.md "What the board shows"):
  // the card someone is dragging or reading, so peers ring it in their colour. Ephemeral, never
  // logged, from any session (a viewer reads items too).
  'plan-presence',
  // Someone's selection on a sheet (docs/specs/029-sheets/sheet.md "Collaboration"): outlined in their colour.
  // Ephemeral, never logged, from any session (a viewer selects too).
  'sheet-presence',
] as const;

// Room op kinds that DO change the document: they get a monotonic `seq` within
// the room's epoch, land in the bounded catch-up log so a reconnecting peer can
// replay them (docs/specs/012-collaboration/realtime-conflict-resolution.md), and are refused from a view-role sender.
//
// `poll-start` / `poll-end` sit here rather than with `poll-answer` above on
// purpose: an audience member on a view link may answer a poll but must not be
// able to start one or end someone else's (docs/specs/012-collaboration/live-poll.md).
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
  'document-meta',
  // One article's writing changing, block by block (docs/specs/007-editor/article-pages.md
  // "Collaboration"): two people writing different paragraphs merge, as `el` does for elements.
  'article',
  'poll-start',
  'poll-end',
] as const;

// Op kinds only the WORKER may originate, stamped `from: 'system'` and pushed
// through the room's /broadcast endpoint. The room drops them outright when they
// arrive on a client socket: without that, any edit-role peer could forge
// `share-revoked` carrying the code from their own URL and force-redirect every
// collaborator out of the session (docs/specs/013-workspace/share-password.md).
//
// `qa` (docs/specs/012-collaboration/qa-board.md) is here for the same reason: it is the api's authoritative
// word on a Q&A board after a write it has already persisted. A client that
// could send one could rewrite every peer's board without touching D1. Unlike
// `share-revoked` it is SEQUENCED into the catch-up log (the worker asks for
// that on the /broadcast body), because it changes the document.
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
// `items` (docs/specs/026-plan/items.md "Live for everyone"): item writes the api made. Items change
// only through the api, so a forged one would show people items nobody wrote. `item-types` likewise
// (docs/specs/026-plan/item-types.md): the catalogue changes only through the api.
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'qa',
  'document-trashed',
  'changeset',
  'items',
  'item-types',
  // `sheets` (docs/specs/029-sheets/sheet-store.md "Live for everyone"): sheet writes the api made. Sheets change
  // only through the api, so a forged one would show people cells nobody wrote.
  'sheets',
] as const;

// The whole vocabulary. Every op the editor sends or handles is one of these
// three kinds of thing, and which one it is decides its ordering, its role gate,
// and whether it may come from a client at all.
export const ROOM_OP_KINDS = [
  ...PRESENCE_OP_KINDS,
  ...MUTATION_OP_KINDS,
  ...SYSTEM_OP_KINDS,
] as const;

export type PresenceOpKind = (typeof PRESENCE_OP_KINDS)[number];

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
  // lock (docs/specs/007-editor/live-app.md), so the room can get on. USING the baton rather than moving
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
  // "Your hold on this element has been released" (docs/specs/007-editor/live-app.md + docs/specs/012-collaboration/facilitator.md), sent
  // to the HOLDER'S SOCKET ALONE. Being sent it is the whole of the addressing:
  // the room mints a presence id per socket and never tells a client which one
  // is its own (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast carrying a target id would reach
  // nobody able to recognise themselves in it. Same trick as the baton token.
  //
  // The receiver drops the selection and re-broadcasts its own `select` op, so
  // every other peer's lock clears through the ordinary path and the room needs
  // to tell nobody else anything.
  | { kind: 'selection-released'; elementId: string; by: string }
  // The ordering cursor this session has reached (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1), sent on
  // `hello` and to the SENDER of each ordered op, which the relay skips. Without
  // it a client only learned seqs from other people's ops, so a reconnect
  // replayed its own ops back at it (and, having heard nothing, the whole log).
  // Harmless for idempotent element ops; a `vote` op is a delta, so every
  // replayed dot was counted twice.
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
  // `facilitatorToken` (docs/specs/012-collaboration/facilitator.md) is the baton coming home after a refresh:
  // the room checks it against the one it issued and, if it still matches,
  // hands the baton to this new socket. Absent on every ordinary hello.
  | { kind: 'hello'; participant: ParticipantPresence; facilitatorToken?: string }
  // `ref`: asks the room to echo it on this op's `cursor` frame (CursorMessage).
  | { kind: 'op'; op: unknown; ref?: number }
  // Ask the room to move the baton (docs/specs/012-collaboration/facilitator.md). The room decides; the client
  // learns the answer from the `facilitator` frame like everybody else.
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
  // carries the element payload (see @livediagram/document ElementOp).
  | { kind: 'el'; tabId: string; op: ElementOp }
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
  // An article's writing on a tab changed (docs/specs/007-editor/article-pages.md
  // "Collaboration"): its block ops, applied by block id, or the whole document gone (`removed`).
  // `Tab.articles` never rides a `tab-meta` patch, which would replace every document wholesale.
  // `created`: the article is new (its first frames): a receiver without it takes it, where puts
  // for an article it no longer has (removed meanwhile) are dropped.
  | { kind: 'article'; tabId: string; flow: string; ops: ArticleOp[]; created?: true }
  | { kind: 'article'; tabId: string; flow: string; removed: true }
  | {
      kind: 'vote';
      tabId: string;
      elementId: string;
      voter: string;
      delta: 1 | -1;
      round?: string;
    }
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
  // The sender's caret in an article's writing (docs/specs/007-editor/article-pages.md
  // "Collaboration"): the top-level block it is in, by id, and how many characters into that
  // block's text it sits, so a receiver places it in their own copy of the writing whatever they
  // typed elsewhere. `flow: null` means the sender's writing lost the caret, so peers drop it.
  // Throttled like the cursor; parsed with parseArticleCaret.
  | { kind: 'article-caret'; tabId: string; flow: string; blockId: string; offset: number }
  | { kind: 'article-caret'; tabId: string; flow: null }
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
  // The sender's Avatar-mode character (docs/specs/008-canvas/avatar-mode.md), so everyone in the room
  // sees everyone else walking around. Ephemeral presence exactly like
  // cursor / laser: throttled to ~30 Hz, never logged, never replayed to a
  // reconnecting client, and `avatar: null` means "I left the mode, drop my
  // character". The tab id scopes rendering to peers looking at the same tab.
  | { kind: 'avatar'; tabId: string; avatar: AvatarPresence | null }
  // One character SHOVES another (docs/specs/008-canvas/avatar-mode.md). Sent by the pusher when their
  // character reaches the person they clicked; only the participant named in
  // `targetId` acts on it, by sliding their own character a short way along
  // (`dx`, `dy`) — a unit vector. Everyone's character stays authoritative on
  // its owner's machine, so a push is a request, never a remote write, and a
  // peer who has left the mode simply ignores it.
  | { kind: 'avatar-push'; tabId: string; targetId: string; dx: number; dy: number }
  // Somebody set off a REACTION PAD (docs/specs/009-elements/reaction-pad.md). Ephemeral exactly like cursor
  // / laser / avatar: never logged, never ordered, never replayed to a
  // reconnecting client — a burst you missed is a burst that is over.
  //
  // Carries the pad's id rather than coordinates: the burst is drawn around
  // the element, and the element is where everyone already agrees it is.
  // Sending x/y would mean a peer who has since moved the pad draws confetti
  // over empty canvas. The reaction rides along so a peer plays the right one
  // even if the pad's field changed under them mid-flight.
  | { kind: 'reaction'; tabId: string; elementId: string; reaction: string }
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
  | { kind: 'viewport'; tabId: string; pan: { x: number; y: number }; zoom: number }
  // --- Bring Focus (docs/specs/012-collaboration/bring-focus.md) ----------------------------------------
  // Somebody pressed a Bring Focus element: offer everyone else a jump to it.
  //
  // Carries the element's CENTRE and the presser's zoom, not the presser's
  // pan. Two people rarely have the same window size, so copying a pan lands
  // the element off-centre (or off-screen) for anyone whose canvas is a
  // different shape; centring the point is the correct translation of "come
  // and look at this", and the zoom is what makes their view show the same
  // amount of canvas.
  //
  // No sender name: the envelope already identifies the sender and the
  // receiver resolves the name from the presence list it holds, so a renamed
  // participant's invitation reads correctly.
  | { kind: 'focus-here'; tabId: string; at: { x: number; y: number }; zoom: number }
  // --- Live poll (docs/specs/012-collaboration/live-poll.md) -------------------------------------------
  // Deliberately NOT a Tab field like the timer / dot-vote: a poll is
  // ephemeral, so nothing here reaches D1 or undo. The
  // room keeps the running poll and its answers in its own storage and
  // replays them on hello (docs/specs/012-collaboration/live-poll.md).
  // `poll-start` / `poll-end` are sequenced mutations; `poll-answer` relays
  // unordered, like presence.
  //
  // The host opened a poll. Replaces any poll already on screen (one at a
  // time per document).
  | { kind: 'poll-start'; poll: LivePoll }
  // One participant's answer; `null` means they skipped. Keyed by sender
  // on receipt, so re-sending REPLACES that person's earlier answer
  // rather than stacking a second one. Allowed from view-role senders
  // too (docs/specs/012-collaboration/live-poll.md) — polling an audience on a view link is the point.
  //
  // `key` is the answerer's collab key (docs/specs/012-collaboration/collab-race-hardening.md): answers used to be keyed
  // by the per-socket presence id, so re-answering after a reconnect counted
  // twice. Optional so an older client still parses.
  //
  // `proof` is the sender's per-browser collab secret (docs/specs/012-collaboration/vote-integrity.md): it proves the
  // key is the sender's own. The room checks it and NEVER relays it; a relayed or replayed answer carries the key the
  // room decided and no proof.
  | { kind: 'poll-answer'; pollId: string; value: string | null; key?: string; proof?: string }
  // The host ended the poll: drop the question, the answers, and the
  // panel everywhere. Edit-role only, like poll-start.
  | { kind: 'poll-end'; pollId: string }
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
  // A Q&A board's whole state after a server write (docs/specs/012-collaboration/qa-board.md). Replaces the
  // element's notes when `rev` is newer than the local `qaRev`.
  | { kind: 'qa'; tabId: string; elementId: string; notes: QaNote[]; rev: number }
  // One changeset the api applied (docs/specs/024-agents/agent-changesets.md "What the room does").
  // Worker-originated through /mutation.
  | ChangesetRoomOp
  // Item writes the api made (docs/specs/026-plan/items.md "Live for everyone"). Worker-originated
  // through an ordered /broadcast; a session scoped to one tab hears it without its items.
  | ItemsRoomOp
  // A document's type catalogue the api stored (docs/specs/026-plan/item-types.md "Storage and sync").
  | ItemTypesRoomOp
  // Sheet writes the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"). Worker-originated
  // through an ordered /broadcast; a session scoped to one tab hears only its tab's.
  | SheetsRoomOp
  // The document went to the Trash (docs/specs/013-workspace/trash.md). Every
  // session shows the deleted state; the room then closes every socket (4004).
  // Worker-originated, like share-revoked.
  | { kind: 'document-trashed' };

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown` — the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | { kind: 'hello'; participant: ParticipantPresence; facilitatorToken?: string }
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
  | {
      kind: 'facilitator';
      holder: string | null;
      by?: string;
      reason: FacilitatorReason;
      token?: string;
    }
  // Addressed by being sent at all — see ServerMessage above.
  | { kind: 'selection-released'; elementId: string; by: string }
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
