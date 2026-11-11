import type { AgentPresence } from '@liveworkspace/api-schema/agent-presence';
import type { OpRefusedMessage } from '@liveworkspace/api-schema/room-refusal';
import type { CollabKeyMessage } from '@liveworkspace/api-schema/collab-key';
import type { ParticipantPresence } from './index';
import type { PresenceBatchMessage } from '@liveworkspace/api-schema/presence-fanout';
import type { RoomOp } from './room-op';

// The op vocabulary's three classes (presence, mutation, system) and their membership tests live in
// room-op-kinds.ts; the editor's op union `RoomOp` in room-op.ts. Both re-export from here, the module
// every caller already imports.
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
// of the client's op union, clients narrow it via their own
// `RoomOp` type and ignore frames they don't recognise.
export type ServerMessage =
  // `agents`: agent presence, apart from `participants` so no session reader counts one (agent-presence PR14).
  | { kind: 'presence'; participants: ParticipantPresence[]; agents: AgentPresence[] }
  // `seq`/`epoch` ride mutation ops only (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): the room
  // assigns each mutation a monotonic sequence within an `epoch` (a random
  // id minted per DO instantiation) so a reconnecting client can ask what
  // it missed. Presence ops (cursor/select/laser/tab-focus) carry neither,
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
  // Harmless for idempotent element ops; a `vote` op is a delta, so every
  // replayed dot was counted twice.
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
export type FormatMessage = {
  kind: 'format';
  format: number;
  build?: string;
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
  | {
      kind: 'hello';
      participant: ParticipantPresence;
      facilitatorToken?: string;
      batches?: boolean;
    }
  // `ref`: asks the room to echo it on this op's `cursor` frame (CursorMessage).
  | { kind: 'op'; op: unknown; ref?: number }
  // Ask the room to move the baton (docs/specs/012-collaboration/facilitator.md). The room decides; the client
  // learns the answer from the `facilitator` frame like everybody else.
  | ({ kind: 'facilitator' } & FacilitatorAction)
  // Sent right after re-connecting (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): "here's the last
  // epoch+seq I applied, tell me what I missed, or that I must re-hydrate".
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

// Client-side narrowings of `ClientMessage` / `ServerMessage` that
// pin `op` to `RoomOp` for type-safe send/receive in the editor.
// The room itself still operates on `op: unknown`, the agnosticism
// stays at the worker boundary.
export type RoomOutgoing =
  | {
      kind: 'hello';
      participant: ParticipantPresence;
      facilitatorToken?: string;
      batches?: boolean;
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
  // Addressed by being sent at all, see ServerMessage above.
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

// The close code for a workbench session whose pairing or token ended (docs/specs/013-workspace/workbench-embeds.md):
// the page turns read-only and does not reconnect.
export const WORKBENCH_ENDED_CLOSE = 4006;

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
