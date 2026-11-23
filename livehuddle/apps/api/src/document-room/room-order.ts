import type { DocumentRoom } from './document-room';

// The room's ordered mutation stream (document-room.ts): the key its `{ epoch, seq }` is kept under across a
// hibernation wake (room-restore.ts restores it), and the one path that puts a mutation into the stream. Each
// function takes the room it acts for.

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

// Record the seq we just handed out. Not awaited: the DO output gate holds
// outbound messages until pending writes land, so a peer can never see an
// op whose seq failed to persist.
function persistOrder(room: DocumentRoom): void {
  void room.state.storage.put(ORDER_STATE_KEY, { epoch: room.epoch, seq: room.seq });
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
