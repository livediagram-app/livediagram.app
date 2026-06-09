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

export function connectRoom(
  diagramId: string,
  participant: { id: string; name: string; color: string },
  handlers: RoomHandlers,
  options: { shareCode?: string | null; ownerId?: string | null } = {},
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
} {
  // Browsers can't set custom headers on a WebSocket upgrade, so the
  // share code (and owner id, for diagrams the visitor owns) ride on
  // the query string. The api worker reads them, resolves role, and
  // forwards an X-Verified-Role header to the Durable Object before
  // the upgrade reaches it. Empty / missing values are stripped so
  // the URL stays clean.
  const params = new URLSearchParams();
  if (options.shareCode) params.set('s', options.shareCode);
  if (options.ownerId) params.set('o', options.ownerId);
  // Share password (spec/24) for a protected diagram's room. The api
  // refuses the upgrade if it's missing / wrong. Read from the same
  // session state apiHeaders uses, so the editor doesn't have to thread
  // it through; owners never have it set so their `o` upgrade bypasses.
  const sharePassword = getSessionSharePassword();
  if (sharePassword) params.set('p', sharePassword);
  const qs = params.toString();
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
