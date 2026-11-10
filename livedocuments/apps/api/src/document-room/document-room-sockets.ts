// Fanning frames out to the room's sockets (document-room.ts): one socket, one presence, or all of them (redacted per
// tab scope), the ordered mutation stream, and closing the sessions a change ends. Each takes the room.
import {
  ACCESS_CHANGED_CLOSE,
  WORKBENCH_ENDED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
} from '@livedocuments/api-schema';
import type { ServerMessage } from '../types';
import { opForScope } from '../room-scope';
import {
  sessionMatchesAccessClose,
  type AccessCloseMatch,
} from '@liveworkspace/api-kit/room-access';
import { type SessionAttachment } from '../room-session';
import type { DocumentRoom } from './document-room';

// How many recent mutation ops the room keeps for reconnect catch-up
// (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). A reconnecting client within this many ops of the
// live tail replays the delta; further behind, it re-hydrates from the document's stored tabs.
// Bounded so an idle-but-connected room can't grow the buffer without end;
// the log lives in memory (like opRates) and resets on hibernation, which
// only ever forces the safe path (a resync), never data loss.
const OP_LOG_LIMIT = 256;

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
// Deliver to the ONE session holding `presenceId`, skipping the sender.
// Used by what is meant for one person (a released selection, who follows them): everyone else has no use for
// the packet, and fanning it out would tell the whole room.
export function sendToPresence(
  room: DocumentRoom,
  presenceId: string,
  payload: ServerMessage,
  except?: WebSocket,
): void {
  const serialized = JSON.stringify(payload);
  for (const ws of room.state.getWebSockets()) {
    if (ws === except) continue;
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment?.presence?.id !== presenceId) continue;
    const out = frameFor(room, ws, payload, serialized);
    if (out === null) return;
    try {
      ws.send(out);
    } catch {
      room.opRates.delete(ws);
    }
    return;
  }
}

export function broadcast(room: DocumentRoom, payload: ServerMessage, except?: WebSocket): void {
  const serialized = JSON.stringify(payload);
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
  room: DocumentRoom,
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

export function scopeOf(room: DocumentRoom, ws: WebSocket): string | null {
  if (room.scopes.has(ws)) return room.scopes.get(ws) ?? null;
  const scope = room.readSession(ws)?.tabScope ?? null;
  room.scopes.set(ws, scope);
  return scope;
}

// After a share-revoked / share-rescoped op has gone out, close every socket
// its code admitted: its holders must stop receiving ops whether or not
// their client honours the op (docs/specs/013-workspace/tab-scoped-share-links.md).
export function closeSessionsOfChangedLink(room: DocumentRoom, op: unknown): void {
  const { kind, code } = (op ?? {}) as { kind?: unknown; code?: unknown };
  if (typeof kind !== 'string' || !SHARE_LINK_OPS.has(kind) || typeof code !== 'string') return;
  closeSockets(room, (ws) =>
    room.readSession(ws)?.shareCode === code ? [SHARE_LINK_CHANGED_CLOSE, kind] : null,
  );
}

// Close every socket `pick` gives a close code and reason, shedding each one's rate window.
// Returns how many it closed.
export function closeSockets(
  room: DocumentRoom,
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
export function closeSessionsForAccessChange(room: DocumentRoom, close: AccessCloseMatch): void {
  const code: [number, string] =
    close.match === 'workbench'
      ? [WORKBENCH_ENDED_CLOSE, 'workbench-ended']
      : [ACCESS_CHANGED_CLOSE, 'access-changed'];
  const closed = closeSockets(room, (ws) =>
    sessionMatchesAccessClose(room.readSession(ws), close) ? code : null,
  );
  console.info('[room-access] closed', { match: close.match, closed });
}

// After a document-trashed op has gone out, close every socket
// (docs/specs/013-workspace/trash.md): the document is in the Trash, and its
// admission refuses every new join until it is restored.
export function closeAllIfTrashed(room: DocumentRoom, op: unknown): void {
  if ((op as { kind?: unknown } | null)?.kind !== 'document-trashed') return;
  closeSockets(room, () => [DOCUMENT_TRASHED_CLOSE, 'document-trashed']);
}

// Put a mutation into the ordered stream: a seq, the catch-up log, every
// socket but the sender's, and the ledger. One path for a peer's op and for
// one the worker made (docs/specs/012-collaboration/collab-race-hardening.md), so the two can't drift. Returns the seq.
export function sequenceMutation(
  room: DocumentRoom,
  from: string,
  op: unknown,
  except?: WebSocket,
): number {
  const seq = ++room.seq;
  persistOrder(room);
  room.opLog.push({ seq, from, op });
  if (room.opLog.length > OP_LOG_LIMIT) room.opLog.shift();
  room.broadcast({ kind: 'op', from, op, seq, epoch: room.epoch }, except);
  room.ledger.record(op, seq);
  return seq;
}

// Record the seq we just handed out. Not awaited: the DO output gate holds
// outbound messages until pending writes land, so a peer can never see an
// op whose seq failed to persist.
export function persistOrder(room: DocumentRoom): void {
  void room.state.storage.put(ORDER_STATE_KEY, { epoch: room.epoch, seq: room.seq });
}

export function broadcastSystemOp(room: DocumentRoom, op: unknown): void {
  // System ops broadcast to ALL peers: the originator is the worker itself,
  // not any connected session, so nobody is excluded.
  room.broadcast({ kind: 'op', from: 'system', op });
}

/** Deliver one frame to one socket. */
export function sendTo(room: DocumentRoom, ws: WebSocket, payload: ServerMessage): void {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    room.opRates.delete(ws);
  }
}
