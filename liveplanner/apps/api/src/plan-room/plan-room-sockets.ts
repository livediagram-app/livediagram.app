// Fanning frames out to the room's sockets (plan-room.ts): one socket, one presence, or all of them (redacted per
// tab scope), the ordered mutation stream, and closing the sessions a change ends. Each takes the room.
import {
  PROJECT_TRASHED_CLOSE,
  ROOM_FRAME_ENVELOPE_BYTES,
  ROOM_FRAME_MAX_BYTES,
  SNAPSHOT_REVERTED_CLOSE,
} from '@liveplanner/api-schema';
import type { ServerMessage } from '../types';
import { opForScope } from '../room-scope';
import {
  accessCloseCode,
  sessionMatchesAccessClose,
  type AccessCloseMatch,
} from '@liveworkspace/api-kit/room-access';
import { isItemsOp, splitItemsOp } from './items-op-split';
import { appendToOpLog } from './op-log';
import type { PlanRoom } from './plan-room';

// DO storage key holding `{ epoch, seq }` so the room keeps its ordering
// identity across a hibernation wake (docs/specs/012-collaboration/resync-without-reload.md).
export const ORDER_STATE_KEY = 'order-state';

// Share-link ops that end the sessions their code admitted.
const SHARE_LINK_OPS = new Set(['share-revoked', 'share-rescoped']);

// Close code for a socket whose share link was revoked or rescoped. In the
// 4000-4999 application range; the client reloads or leaves on the op itself.
const SHARE_LINK_CHANGED_CLOSE = 4003;

// Fan an op out to every connected client without a sender. Used
// for server-originated events (share-link revoked, owner-side
// forced disconnects). Senders aren't excluded because the
// originator is the worker itself, not any of the connected peers.
// Serialize once and send to every connected session (optionally excluding
// one, e.g. the op's originator). The connected set is the runtime's
// hibernation-managed list (`state.getWebSockets()`), which drops closed
// sockets on its own; a send that still throws means a socket that died
// without the runtime noticing yet, so we just shed its rate entry — the
// runtime reaps the socket itself.
// `serialized` is the payload's JSON when the caller already made it (sequenceMutation, which sizes the log by it).
export function broadcast(
  room: PlanRoom,
  payload: ServerMessage,
  except?: WebSocket,
  serialized: string = JSON.stringify(payload),
): void {
  for (const ws of room.state.getWebSockets()) {
    if (ws === except) continue;
    const out = frameFor(room, ws, payload, serialized);
    if (out === null) continue;
    try {
      ws.send(out);
    } catch {
      room.opRates.delete(ws);
    }
  }
}

// The frame one socket should receive for `payload`: as serialised for an
// unscoped session, redacted or withheld (null) for a tab-scoped one
// (docs/specs/013-workspace/tab-scoped-share-links.md). Only op frames carry tab content.
export function frameFor(
  room: PlanRoom,
  ws: WebSocket,
  payload: ServerMessage,
  serialized: string,
): string | null {
  if (payload.kind !== 'op') return serialized;
  const scope = scopeOf(room, ws);
  if (scope === null) return serialized;
  const op = opForScope(payload.op, scope);
  if (op === null) return null;
  return op === payload.op ? serialized : JSON.stringify({ ...payload, op });
}

export function scopeOf(room: PlanRoom, ws: WebSocket): string | null {
  if (room.scopes.has(ws)) return room.scopes.get(ws) ?? null;
  const scope = room.readSession(ws)?.tabScope ?? null;
  room.scopes.set(ws, scope);
  return scope;
}

// After a share-revoked / share-rescoped op has gone out, close every socket
// its code admitted: its holders must stop receiving ops whether or not
// their client honours the op (docs/specs/013-workspace/tab-scoped-share-links.md).
export function closeSessionsOfChangedLink(room: PlanRoom, op: unknown): void {
  const { kind, code } = (op ?? {}) as { kind?: unknown; code?: unknown };
  if (typeof kind !== 'string' || !SHARE_LINK_OPS.has(kind) || typeof code !== 'string') return;
  closeSockets(room, (ws) =>
    room.readSession(ws)?.shareCode === code ? [SHARE_LINK_CHANGED_CLOSE, kind] : null,
  );
}

// After a project-trashed op has gone out, close every socket (docs/specs/013-workspace/trash.md "Open editors"): the
// plan is in the Trash, and no grant admits a join until it is restored. Returns how many it closed.
export function closeAllIfTrashed(room: PlanRoom, op: unknown): number {
  if ((op as { kind?: unknown } | null)?.kind !== 'project-trashed') return 0;
  return closeSockets(room, () => [PROJECT_TRASHED_CLOSE, 'project-trashed']);
}

// Close every socket `pick` gives a close code and reason, shedding each one's rate window.
// Returns how many it closed.
export function closeSockets(
  room: PlanRoom,
  pick: (ws: WebSocket) => [code: number, reason: string] | null,
): number {
  let closed = 0;
  for (const ws of room.state.getWebSockets()) {
    const close = pick(ws);
    if (!close) continue;
    try {
      ws.close(...close);
    } catch {
      // Already gone.
    }
    room.opRates.delete(ws);
    closed++;
  }
  return closed;
}

// Close every session an access change affects (room-access.ts). The editor reloads on the
// close code, so the next join meets the gates again.
export function closeSessionsForAccessChange(room: PlanRoom, close: AccessCloseMatch): void {
  // A workbench pairing's 4006, an archive's 4010 (every socket), any other change's 4005.
  const code = accessCloseCode(close);
  const closed = closeSockets(room, (ws) =>
    sessionMatchesAccessClose(room.readSession(ws), close) ? code : null,
  );
  console.info('[room-access] closed', { match: close.match, closed });
}

// Put a mutation into the ordered stream: a seq, the catch-up log, every
// socket but the sender's, and the ledger. One path for a peer's op and for
// one the worker made (docs/specs/012-collaboration/collab-race-hardening.md), so the two can't drift. Returns the seq.
// The log is capped by count and by size (op-log.ts; Work Tracker 1231).
export function sequenceMutation(
  room: PlanRoom,
  from: string,
  op: unknown,
  except?: WebSocket,
): number {
  const seq = ++room.seq;
  persistOrder(room);
  // Serialised once: the relay sends this text and the catch-up log sizes the op by it (op-log.ts).
  const payload: ServerMessage = { kind: 'op', from, op, seq, epoch: room.epoch };
  const serialized = JSON.stringify(payload);
  appendToOpLog(room.opLog, { seq, from, op }, serialized.length);
  broadcast(room, payload, except, serialized);
  room.ledger.record(op, seq);
  return seq;
}

// Record the seq we just handed out. Not awaited: the DO output gate holds
// outbound messages until pending writes land, so a peer can never see an
// op whose seq failed to persist.
export function persistOrder(room: PlanRoom): void {
  void room.state.storage.put(ORDER_STATE_KEY, { epoch: room.epoch, seq: room.seq });
}

export function broadcastSystemOp(room: PlanRoom, op: unknown): void {
  // System ops broadcast to ALL peers: the originator is the worker itself,
  // not any connected session, so nobody is excluded.
  room.broadcast({ kind: 'op', from: 'system', op });
}

/** Deliver one frame to one socket. */
export function sendTo(room: PlanRoom, ws: WebSocket, payload: ServerMessage): void {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    room.opRates.delete(ws);
  }
}

// A system op that changes the project (docs/specs/026-plan/items.md "Live for everyone"): sequenced and logged
// exactly like a client mutation, so `resolveCatchup` replays it. Nobody is
// excluded from the relay (there is no sending socket), so there is no
// separate `cursor` frame to send back either.
// An `items` op past the frame size goes out as ordered parts, each its own seq (items-op-split.ts; Work Tracker 986).
export function broadcastOrderedSystemOp(room: PlanRoom, op: unknown): void {
  if (!isItemsOp(op)) {
    sequenceMutation(room, 'system', op);
    return;
  }
  const parts = splitItemsOp(op, ROOM_FRAME_MAX_BYTES - ROOM_FRAME_ENVELOPE_BYTES);
  if (parts.length > 1) console.info('[room] items op split', { parts: parts.length });
  for (const part of parts) sequenceMutation(room, 'system', part);
}

// A snapshot's revert replaced the plan in place (plan-snapshots.ts): the ledger's entries describe content that is
// gone, so it is cleared, and every session is closed so each editor reloads onto the reverted plan.
export function closeAllReverted(room: PlanRoom): void {
  void room.ledger.clear();
  closeSockets(room, () => [SNAPSHOT_REVERTED_CLOSE, 'snapshot-reverted']);
}
