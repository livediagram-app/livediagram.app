// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livedocuments/api-schema` so the editor and
// (eventually) any other client share one definition. The client itself (the socket's lifecycle, its
// keepalive, reconnect backoff, outbox and sequence acks) is shared with livedesign in
// `@liveworkspace/workbench/lib/room-client`; this door binds it to the document wire and keeps the exports.
import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  isMutationOpKind,
  ROOM_PING,
  ROOM_PONG,
  WORKBENCH_ENDED_CLOSE,
  type ParticipantPresence,
  type RoomOp,
  type RoomOutgoing,
} from '@livedocuments/api-schema';
import { opForTheWire } from '@livedocuments/document';
import {
  connectRoomClient,
  type RoomClientHandlers,
  type RoomClientWire,
  type RoomConnectOptions,
} from '@liveworkspace/workbench/lib/room-client';
import { splitPresenceFrame } from '../agent-presence-rows';
import { noteServerBuild, noteServerDocumentFormat } from '../server-release';
import { startEditorTiming } from '../timing';
import { wsUrl } from './core';

export {
  ROOM_FULL_NOTICE,
  ROOM_KEEPALIVE_IDLE_MS,
  ROOM_KEEPALIVE_TIMEOUT_MS,
  ROOM_SEQUENCE_ACK_TIMEOUT_MS,
  roomQueryString,
} from '@liveworkspace/workbench/lib/room-client';

export type RoomHandlers = RoomClientHandlers<RoomOp, ParticipantPresence> & {
  // The document went to the Trash (docs/specs/013-workspace/trash.md): the room
  // closed this socket with DOCUMENT_TRASHED_CLOSE and will refuse every
  // reconnect, so the connector stops and says so, once.
  onDocumentTrashed?: () => void;
};

/** Who this client says it is to the room: the room overrides `id` (see connectRoom). `picture` is the published
 *  Google picture (docs/specs/014-identity/profile-picture.md §2); the room keeps it only from an account session. */
type RoomSelf = { id: string; name: string; color: string; picture?: string };

const documentWire: RoomClientWire<RoomOp, ParticipantPresence, RoomHandlers> = {
  trashedClose: DOCUMENT_TRASHED_CLOSE,
  accessChangedClose: ACCESS_CHANGED_CLOSE,
  workbenchEndedClose: WORKBENCH_ENDED_CLOSE,
  ping: ROOM_PING,
  pong: ROOM_PONG,
  isMutationOpKind,
  opForTheWire: (op) => opForTheWire(op) as RoomOp,
  splitPresenceFrame,
  noteServerFormat: noteServerDocumentFormat,
  noteServerBuild,
  startTiming: startEditorTiming,
  socketUrl: (documentId, qs) => wsUrl(`/documents/${documentId}/ws${qs ? `?${qs}` : ''}`),
  onTrashed: (handlers) => handlers.onDocumentTrashed?.(),
};

export function connectRoom(
  documentId: string,
  // The room OVERRIDES `id` with its own per-socket presence id (docs/specs/015-api/public-api-and-tokens.md §6).
  initialParticipant: RoomSelf,
  handlers: RoomHandlers,
  options: RoomConnectOptions = {},
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
  cursor: () => { epoch: string; seq: number } | null;
  sequence: (op: RoomOp) => Promise<boolean>;
  updateSelf: (participant: RoomSelf) => void;
} {
  return connectRoomClient<RoomOp, RoomOutgoing, ParticipantPresence, RoomSelf, RoomHandlers>(
    documentWire,
    documentId,
    initialParticipant,
    handlers,
    options,
  );
}
