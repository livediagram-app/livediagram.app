import type { AgentPresence } from '@liveworkspace/api-schema/agent-presence';
import type { OpRefusedMessage } from '@liveworkspace/api-schema/room-refusal';
import type { CollabKeyMessage } from '@liveworkspace/api-schema/collab-key';
import type { ParticipantPresence } from './index';
import type { PresenceBatchMessage } from '@liveworkspace/api-schema/presence-fanout';
import type { RoomOp } from './room-op';
import type {
  CursorMessage,
  GrantMessage,
  GrantRenewMessage,
} from '@liveworkspace/api-schema/room-wire';

// ---------------------------------------------------------------------
// Realtime room messages
// ---------------------------------------------------------------------

// One participant's Avatar-mode character and its statuses (docs/specs/008-canvas/avatar-mode.md) are Avatar mode's
// wire shapes, in @livehuddle/avatar/wire; re-exported so this package's surface is unchanged.
export { AVATAR_STATUS_IDS, expandAvatarPacket, isLeanAvatarPacket } from '@livehuddle/avatar/wire';
export type { AvatarPacket, AvatarPresence, AvatarStatus } from '@livehuddle/avatar/wire';

// The op classes (presence, mutation, system) and their membership tests live in room-op-kinds.ts, and the
// editor's op union in room-op.ts; re-exported so this module's surface is unchanged.
export * from './room-op-kinds';
export type { RoomOp } from './room-op';

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

// The room's wire pieces every product's room shares (@liveworkspace/api-schema/room-wire): the op `ref` echo,
// grant renewal, the close codes and the keepalive.
export {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_GRANT_ASK_BEFORE_MS,
  ROOM_PING,
  ROOM_PONG,
  isRoomOpRef,
  type CursorMessage,
  type GrantMessage,
  type GrantRenewMessage,
} from '@liveworkspace/api-schema/room-wire';

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

// A link visitor naming themselves (ClientMessage below).
export type VisitorNameMessage = { kind: 'visitor-name'; name: string };

// Any session changing its colour (ClientMessage below).
export type PresenceColourMessage = { kind: 'presence-colour'; color: string };

/** POST /api/documents/:id/room-name: the name the room now shows for the caller, or null when it has none. */
export type RoomNameResponse = { name: string | null };

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
  // `visitor`: this browser's own secret (docs/specs/013-workspace/share-roles.md "The collab key"): a session with no
  // identity takes its collab key from it, one key per browser. Never relayed, never on the roster.
  | {
      kind: 'hello';
      participant: ParticipantPresence;
      facilitatorToken?: string;
      batches?: boolean;
      leanAvatars?: boolean;
      visitor?: string;
    }
  // `ref`: asks the room to echo it on this op's `cursor` frame (CursorMessage).
  | { kind: 'op'; op: unknown; ref?: number }
  // The name a session with no identity typed in the join dialog (docs/specs/014-identity/auth-and-guest-access.md
  // "Presence names"): the room keeps it under the browser's collab key and names the session by it. Refused from a
  // session with an identity, whose name is their profile's. The hello's own `participant.name` is never read.
  | VisitorNameMessage
  // A session's new colour (docs/specs/014-identity/auth-and-guest-access.md "Presence colours"): the room checks it
  // like the hello's and shows it at once, without a reconnect.
  | PresenceColourMessage
  // Ask the room to move the baton (docs/specs/012-collaboration/facilitator.md). The room decides; the client
  // learns the answer from the `facilitator` frame like everybody else.
  | ({ kind: 'facilitator' } & FacilitatorAction)
  // Sent right after re-connecting (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): "here's the last
  // epoch+seq I applied — tell me what I missed, or that I must re-hydrate".
  // `epoch` is null on a client that hasn't seen an ordered op yet.
  | { kind: 'sync'; epoch: string | null; lastSeq: number }
  | GrantMessage;

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
      visitor?: string;
    }
  | { kind: 'op'; op: RoomOp; ref?: number }
  | VisitorNameMessage
  | PresenceColourMessage
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
