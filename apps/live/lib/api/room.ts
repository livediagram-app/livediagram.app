// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livediagram/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// below is the client-side callback shape only — not on the wire —
// so it stays here next to the connect helper.
import type {
  ParticipantPresence,
  RoomIncoming,
  RoomOp,
  RoomOutgoing,
} from '@livediagram/api-schema';
import { getSessionSharePassword, wsUrl } from './core';

export type RoomHandlers = {
  onPresence: (participants: ParticipantPresence[]) => void;
  onOp: (from: string, op: RoomOp) => void;
  onClose?: () => void;
};

// Auth identifiers the connector rides on the room WebSocket URL.
export type RoomAuthOptions = {
  shareCode?: string | null;
  ownerId?: string | null;
  // One-time room ticket (spec/11), minted over authenticated REST via
  // apiCreateRoomTicket. The only leg that can admit a team member —
  // the worker doesn't trust a bare `o` for team membership.
  ticket?: string | null;
};

// Build the room WebSocket auth query string. Browsers can't set custom
// headers on a WebSocket upgrade, so these ride on the query string; the
// api worker reads them, resolves role, and forwards an X-Verified-Role
// header to the Durable Object before the upgrade reaches it. Empty /
// missing values are stripped so the URL stays clean.
//   - `t` one-time room ticket (spec/11) — proof the connector passed
//     the authenticated REST access gates moments ago; required for
//     team diagrams, where a bare owner id is not trusted.
//   - `s` share code, `o` owner id (for diagrams the visitor owns)
//   - `p` share password (spec/24) for a protected diagram's room.
// (A `g` guest-signature param used to ride along for presence-identity
// binding; the DO switched to server-random ephemeral presence ids —
// spec/61 §6 — and the server-side read was removed, so the client
// stopped sending it.)
// Pure (sharePassword passed in) so the param mapping is unit-tested.
export function roomQueryString(options: RoomAuthOptions, sharePassword: string | null): string {
  const params = new URLSearchParams();
  if (options.ticket) params.set('t', options.ticket);
  if (options.shareCode) params.set('s', options.shareCode);
  if (options.ownerId) params.set('o', options.ownerId);
  if (sharePassword) params.set('p', sharePassword);
  return params.toString();
}

export function connectRoom(
  diagramId: string,
  participant: { id: string; name: string; color: string },
  handlers: RoomHandlers,
  options: RoomAuthOptions = {},
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
} {
  // Auth identifiers ride on the query string (see roomQueryString). The
  // share password is read from the same session state apiHeaders uses, so
  // the editor doesn't have to thread it through; owners never have it set.
  const qs = roomQueryString(options, getSessionSharePassword());
  const ws = new WebSocket(wsUrl(`/diagrams/${diagramId}/ws${qs ? `?${qs}` : ''}`));
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ kind: 'hello', participant } satisfies RoomOutgoing));
  });
  ws.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data) as RoomIncoming;
      if (msg.kind === 'presence') handlers.onPresence(msg.participants);
      else if (msg.kind === 'op') handlers.onOp(msg.from, msg.op);
    } catch {
      // Malformed frame — ignore. Production would log here.
    }
  });
  ws.addEventListener('close', () => handlers.onClose?.());
  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
}
