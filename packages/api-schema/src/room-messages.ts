import type { ElementOp, Tab } from '@livediagram/diagram';
import type { ChangeLogEntry, ParticipantPresence } from './index';
import type { AvatarConfig } from './avatar';
import type { LivePoll } from './poll';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// One participant's Avatar-mode character (spec/101), as it travels over the
// presence channel. Position is the character's FEET in canvas coords; the
// animation inputs and the costume ride along so a peer draws the same
// character, walk cycle, hop, and flag wave the sender sees. Deliberately
// small — this goes out at cursor rates.

export type AvatarPresence = {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  // The sender's costume (spec/101): gender / clothing / hair / size, each a
  // preset token from a closed set. Optional so a packet from an older client
  // still parses — the receiver falls back to the default character. Purely
  // cosmetic, and never an identity claim.
  config?: AvatarConfig;
  // A reaction in progress (spec/101): which one, and how far into it the
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
  // Chair (spec/130): the element id of the chair this character is sitting
  // on, or null / absent when standing.
  //
  // Occupancy rides HERE, on ephemeral presence, and is deliberately never
  // written to the diagram: a chair therefore cannot be left permanently
  // occupied by somebody who closed their laptop, cannot conflict between two
  // clients, and reaches D1, the change log and undo not at all. Optional so a
  // packet from an older client still parses as "standing".
  seatedOn?: string | null;
};

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
  | {
      kind: 'laser';
      tabId: string;
      x: number;
      y: number;
      // The sender's pen (spec/111): width / colour / trail / effect, each a
      // preset token. Optional, so a packet from an older client still parses
      // and simply draws the original laser. It rides the sample rather than a
      // separate op because a second packet would need ordering against the
      // samples it describes, for a couple of dozen bytes on a frame that is
      // already throttled to ~30 Hz. Receivers parse it field by field.
      look?: {
        width: 'fine' | 'medium' | 'bold';
        colour:
          'presence' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'violet' | 'white';
        trail: 'quick' | 'normal' | 'long';
        effect: 'beam' | 'glow' | 'comet' | 'spark';
      };
    }
  // The sender's Avatar-mode character (spec/101), so everyone in the room
  // sees everyone else walking around. Ephemeral presence exactly like
  // cursor / laser: throttled to ~30 Hz, never logged, never replayed to a
  // reconnecting client, and `avatar: null` means "I left the mode, drop my
  // character". The tab id scopes rendering to peers looking at the same tab.
  | { kind: 'avatar'; tabId: string; avatar: AvatarPresence | null }
  // One character SHOVES another (spec/101). Sent by the pusher when their
  // character reaches the person they clicked; only the participant named in
  // `targetId` acts on it, by sliding their own character a short way along
  // (`dx`, `dy`) — a unit vector. Everyone's character stays authoritative on
  // its owner's machine, so a push is a request, never a remote write, and a
  // peer who has left the mode simply ignores it.
  | { kind: 'avatar-push'; tabId: string; targetId: string; dx: number; dy: number }
  // Somebody set off a REACTION PAD (spec/135). Ephemeral exactly like cursor
  // / laser / avatar: never logged, never ordered, never replayed to a
  // reconnecting client — a burst you missed is a burst that is over.
  //
  // Carries the pad's id rather than coordinates: the burst is drawn around
  // the element, and the element is where everyone already agrees it is.
  // Sending x/y would mean a peer who has since moved the pad draws confetti
  // over empty canvas. The reaction rides along so a peer plays the right one
  // even if the pad's field changed under them mid-flight.
  | { kind: 'reaction'; tabId: string; elementId: string; reaction: string }
  // The sender's VIEWPORT (spec/131): where they are looking, so anyone who
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
  // --- Live poll (spec/88) -------------------------------------------
  // Deliberately NOT a Tab field like the timer / dot-vote: a poll is
  // ephemeral, so it exists only as these ops and the memory of the
  // clients that received them. Nothing here reaches D1, the change log,
  // or undo. All three relay unordered (no seq) and are never replayed to
  // a reconnecting client — which is exactly why a late joiner isn't
  // prompted.
  //
  // The host opened a poll. Replaces any poll already on screen (one at a
  // time per diagram).
  | { kind: 'poll-start'; poll: LivePoll }
  // One participant's answer; `null` means they skipped. Keyed by sender
  // on receipt, so re-sending REPLACES that person's earlier answer
  // rather than stacking a second one. Allowed from view-role senders
  // too (spec/88) — polling an audience on a view link is the point.
  | { kind: 'poll-answer'; pollId: string; value: string | null }
  // The host ended the poll: drop the question, the answers, and the
  // panel everywhere. Edit-role only, like poll-start.
  | { kind: 'poll-end'; pollId: string }
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
