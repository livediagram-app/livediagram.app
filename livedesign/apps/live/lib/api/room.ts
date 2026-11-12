// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livedesign/api-schema` so the editor and
// (eventually) any other client share one definition. The client itself (the socket's lifecycle, its
// keepalive, reconnect backoff, outbox and sequence acks) is shared with livedocuments in
// `@liveworkspace/workbench/lib/room-client`; this door binds it to the design wire and keeps the exports.
import {
  ACCESS_CHANGED_CLOSE,
  DESIGN_TRASHED_CLOSE,
  isMutationOpKind,
  ROOM_PING,
  ROOM_PONG,
  WORKBENCH_ENDED_CLOSE,
  type ParticipantPresence,
  type RoomOp,
  type RoomOutgoing,
} from '@livedesign/api-schema';
import { opForTheWire } from '@livedesign/design';
import {
  connectRoomClient,
  type RoomClientHandlers,
  type RoomClientWire,
  type RoomConnectOptions,
} from '@liveworkspace/workbench/lib/room-client';
import { splitPresenceFrame } from '../agent-presence-rows';
import { noteServerBuild, noteServerDesignFormat } from '../server-release';
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
  // The design went to the Trash (docs/specs/013-workspace/trash.md): the room
  // closed this socket with DESIGN_TRASHED_CLOSE and will refuse every
  // reconnect, so the connector stops and says so, once.
  onDesignTrashed?: () => void;
};

/** Who this client says it is to the room: the room overrides `id` (see connectRoom). `picture`: the published
 *  Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), which the room keeps only from an account. */
type RoomSelf = { id: string; name: string; color: string; key?: string; picture?: string };

const designWire: RoomClientWire<RoomOp, ParticipantPresence, RoomHandlers> = {
  trashedClose: DESIGN_TRASHED_CLOSE,
  accessChangedClose: ACCESS_CHANGED_CLOSE,
  workbenchEndedClose: WORKBENCH_ENDED_CLOSE,
  ping: ROOM_PING,
  pong: ROOM_PONG,
  isMutationOpKind,
  opForTheWire: (op) => opForTheWire(op) as RoomOp,
  splitPresenceFrame,
  noteServerFormat: noteServerDesignFormat,
  noteServerBuild,
  startTiming: startEditorTiming,
  socketUrl: (designId, qs) => wsUrl(`/designs/${designId}/ws${qs ? `?${qs}` : ''}`),
  onTrashed: (handlers) => handlers.onDesignTrashed?.(),
};

export function connectRoom(
  designId: string,
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
    designWire,
    designId,
    initialParticipant,
    handlers,
    options,
  );
}
