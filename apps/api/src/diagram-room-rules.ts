// The two decisions the realtime room makes that are pure functions of their
// inputs: what a hello frame is allowed to put in the presence roster, and
// what a reconnecting client gets back when it asks what it missed.
//
// Both were inline in DiagramRoom.webSocketMessage / sendCatchup, wrapped in
// the socket plumbing that sends the result. Both are also the parts most
// worth being able to test directly: the first is a trust boundary (spec/61
// §6), the second is a five-case ladder (spec/75, Level 1) whose branches are
// easy to state and awkward to reach through a live WebSocket.
//
// Kept as functions taking plain values, so neither touches `this`, a socket,
// or storage. The room stays the owner of everything stateful: minting the
// seq, trimming the log, serialising the attachment, broadcasting.

import { MAX_COLOR_LEN, MAX_PARTICIPANT_NAME_LEN } from './limits';
import type { ParticipantPresence } from '@livediagram/api-schema';

// A tabId is clamped like the name and colour so a hostile hello can't push an
// oversize string into the socket attachment.
export const MAX_TAB_ID_LEN = 128;

// What a client sent in its `hello`, before any of it is believed.
export type ClaimedPresence = Partial<ParticipantPresence> | null | undefined;

// Build the presence the room will store for a session, from what the client
// claimed plus what the server already knows about it.
//
// The server-resolved role and the server-assigned ephemeral id ALWAYS win:
// the hello frame's own `role` / `id` are not trusted. The id override hides
// the real owner id (spec/61 §6) and stops a joiner impersonating another
// peer; the role override is the Viewer / Editor lie-defence. Both come from
// the socket attachment, the only per-session store that survives hibernation.
//
// Fields are built explicitly rather than spread, and every string is
// length-clamped, so a hostile hello can neither smuggle arbitrary keys into
// the attachment nor blow its size budget.
export function helloPresence(
  claimed: ClaimedPresence,
  // verifiedRole is optional on the attachment (it is absent for a session
  // that upgraded before the role was stamped), and ParticipantPresence.role
  // is optional for the same reason. Passed straight through, as before.
  session: { presenceId: string; verifiedRole?: 'edit' | 'view' },
): ParticipantPresence {
  const c = claimed ?? ({} as Partial<ParticipantPresence>);
  const presence: ParticipantPresence = {
    id: session.presenceId,
    name: typeof c.name === 'string' ? c.name.slice(0, MAX_PARTICIPANT_NAME_LEN) : '',
    color: typeof c.color === 'string' ? c.color.slice(0, MAX_COLOR_LEN) : '',
    role: session.verifiedRole,
  };
  if (typeof c.tabId === 'string') presence.tabId = c.tabId.slice(0, MAX_TAB_ID_LEN);
  return presence;
}

export type LoggedOp = { seq: number; from: string; op: unknown };

// Decide what a client's `sync` gets back, given the last epoch + seq it
// applied (spec/75, Level 1):
//
//   - Same epoch, caught up (lastSeq >= seq) → empty delta.
//   - Same epoch, within the log window → replay ops after lastSeq.
//   - Same epoch but behind the trimmed log floor → resync (we no longer
//     hold the ops it missed).
//   - Fresh client (no epoch, lastSeq 0) → replay the whole current log;
//     element ops apply idempotently by id, so re-applying ops the client
//     already has from its D1 hydrate is harmless.
//   - Any other epoch mismatch with prior progress → resync: the client saw a
//     previous room instance and we can't map its seq onto ours.
export function resolveCatchup(
  asked: { epoch: string | null; lastSeq: number },
  room: { epoch: string; seq: number; opLog: readonly LoggedOp[] },
): { ops: LoggedOp[]; resync: boolean } {
  const floor = room.opLog.length ? room.opLog[0]!.seq : room.seq + 1;
  if (asked.epoch === room.epoch) {
    if (asked.lastSeq >= room.seq) return { ops: [], resync: false };
    if (asked.lastSeq + 1 >= floor)
      return { ops: room.opLog.filter((e) => e.seq > asked.lastSeq), resync: false };
    return { ops: [], resync: true };
  }
  if (!asked.epoch && asked.lastSeq === 0) return { ops: room.opLog.slice(), resync: false };
  return { ops: [], resync: true };
}

/** One session's sliding-window frame counter. Resets on hibernation. */
export type RateWindow = { count: number; windowStart: number };

// The per-session flood cap, as a pure decision: given the window a socket is
// currently in and the time now, may this frame through, and what is the
// window afterwards?
//
// Applied to EVERY parsed frame, not just ops. A legitimate client sends one
// `hello` per connection, but each `hello` re-runs the O(N^2) presence fanout,
// so an uncapped `hello` loop was a flood path straight through the door the
// cap exists to close.
//
// The window is a simple reset-on-expiry rather than a rolling average: a
// burst right after a boundary can briefly reach twice the cap, which is fine
// for a flood defence and much cheaper than keeping timestamps per frame.
//
// The three branches are the whole behaviour, and the room's own test has to
// build a second DiagramRoom to reach the third, so they are worth being able
// to state directly.
export function admitFrame(
  rate: RateWindow | undefined,
  now: number,
  cap: number,
): { admit: boolean; rate: RateWindow } {
  // No window, or the last one has aged out: this frame opens a fresh one.
  if (!rate || now - rate.windowStart >= 1000) {
    return { admit: true, rate: { count: 1, windowStart: now } };
  }
  // At the cap: drop the frame and leave the window untouched, so a flooding
  // socket cannot extend its own window by continuing to send.
  if (rate.count >= cap) return { admit: false, rate };
  return { admit: true, rate: { count: rate.count + 1, windowStart: rate.windowStart } };
}
