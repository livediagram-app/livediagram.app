import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  ROOM_FULL_CLOSE,
  SNAPSHOT_REVERTED_CLOSE,
  ROOM_FULL_REASON,
  roomIsFull,
  viewOnlyRoomIsFull,
  WORKBENCH_ENDED_CLOSE,
} from '@livediagram/api-schema';
import {
  sessionMatchesAccessClose,
  type AccessCloseMatch,
} from '@liveworkspace/api-kit/room-access';
import type { RelaySession } from '@liveworkspace/api-kit/room-presence-relay';
import { opForScope } from '../room-scope';
import type { SessionAttachment } from '../room-session';
import type { ServerMessage } from '../types';
import type { DocumentRoom } from './document-room';

// The room's sockets (document-room.ts): who is turned away, what each one is sent, and which ones are closed.
// Each function takes the room it acts for.

// Share-link ops that end the sessions their code admitted.
const SHARE_LINK_OPS = new Set(['share-revoked', 'share-rescoped']);
// Close code for a socket whose share link was revoked or rescoped. In the
// 4000-4999 application range; the client reloads or leaves on the op itself.
const SHARE_LINK_CHANGED_CLOSE = 4003;

// The hibernation tag a view-only socket is accepted under (an MCP live view's, a view-only ticket's), so the room
// counts its views without reading every attachment.
export const VIEW_ONLY_TAG = 'view-only';

// Turn an upgrade away when the room is full for it: accepted only to be closed with ROOM_FULL_CLOSE, never handed to
// the hibernation runtime, so it holds no session and receives nothing. People and view-only sockets count apart
// (docs/specs/015-api/api.md "A room holds at most 100 connections"): a person is turned away at ROOM_MAX_CONNECTIONS
// people, whatever views are watching, and a view at ROOM_MAX_VIEW_ONLY views, so views alone can never fill it.
export function turnAwayIfFull(room: DocumentRoom, server: WebSocket, viewOnly = false): boolean {
  const all = room.state.getWebSockets().length;
  const views = room.state.getWebSockets(VIEW_ONLY_TAG).length;
  const full = viewOnly ? viewOnlyRoomIsFull(views) : roomIsFull(all - views);
  if (!full) return false;
  console.warn('[room] full', { documentId: room.documentId, connections: all, views, viewOnly });
  server.accept();
  server.close(ROOM_FULL_CLOSE, ROOM_FULL_REASON);
  return true;
}

// Fan an op out to every connected client without a sender. Used
// for server-originated events (share-link revoked, owner-side
// forced disconnects). Senders aren't excluded because the
// originator is the worker itself, not any of the connected peers.
// Serialize once and send to every connected session (optionally excluding
// one, e.g. the op's originator). The connected set is the runtime's
// hibernation-managed list (`state.getWebSockets()`), which drops closed
// sockets on its own; a send that still throws means a socket that died
// without the runtime noticing yet, so we just shed its rate entry; the
// runtime reaps the socket itself.
// Deliver to the ONE session holding `presenceId`, skipping the sender.
// Used by the addressed messages (the facilitator's, docs/specs/012-collaboration/facilitator.md):
// everyone else has no use for the packet, and fanning it out would leak who
// it is for to the whole room.
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

// A socket's tab scope, read once per socket and kept on the room (its `scopes` says why).
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
export function closeAllIfTrashed(room: DocumentRoom, op: unknown): number {
  if ((op as { kind?: unknown } | null)?.kind !== 'document-trashed') return 0;
  return closeSockets(room, () => [DOCUMENT_TRASHED_CLOSE, 'document-trashed']);
}

// A snapshot's revert replaced the canvas in place (document-snapshots.ts): the ledger's entries describe content that
// is gone, so it is cleared, and every session is closed so each editor reloads onto the reverted canvas.
export function closeAllReverted(room: DocumentRoom): void {
  void room.ledger.clear();
  closeSockets(room, () => [SNAPSHOT_REVERTED_CLOSE, 'snapshot-reverted']);
}

// What the presence relay reads of a session: its tab, the other pane of a split, and whether it batches.
export function relaySessionOf(session: SessionAttachment | null): RelaySession | null {
  const presence = session?.presence;
  if (!presence) return null;
  return {
    ...(presence.tabId ? { tabId: presence.tabId } : {}),
    ...(presence.besideTabId ? { besideTabId: presence.besideTabId } : {}),
    batches: session.batches === true,
  };
}
