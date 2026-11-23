// What the room's constructor (document-room.ts) wires up, apart from its content: the item's tier, the Call Minutes
// meter, a Participant's writes, the surface the api worker's internal endpoints act on, and the facilitator's
// baton. Each takes the room.
import { roomTier } from '@liveworkspace/automations/room';
import { subscriptionClientOf, type ItemTier } from '@liveworkspace/subscription';
import { CALL_METER_KEY, CallMeter, type CallMeterState } from '../calls/call-meter';
import { callsConfigured } from '../calls/calls-gate';
import { severSession, type RealtimeEnv } from '../calls/realtime-api';
import { RoomFacilitator } from '../room-facilitator';
import type { InternalRoom } from '../room-internal';
import { RoomParticipantWrites } from '../room-participant';
import type { DocumentRoom } from './document-room';
import { callSessionHolders, endCallSessions } from './room-call-sessions';
import { renamePerson } from './room-names';
import { handleAgentPresence, liveSessions, socketByPresence } from './room-roster';
import { closeAllIfTrashed, closeSessionsForAccessChange } from './room-sockets';

// The item's tier (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an item"): read from the
// Space's owner. With Pro off it asks nothing and every limit is the legacy one.
export function newRoomTier(room: DocumentRoom): ItemTier {
  return roomTier({
    app: 'livehuddle.app',
    env: () => room.roomEnv ?? null,
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    table: 'document',
    id: () => room.documentId,
    defer: (work) => room.state.waitUntil(work),
  });
}

// The Space's Call Minutes meter (docs/specs/012-collaboration/call-minutes.md "The meter"; calls/call-meter.ts):
// with Pro on, one minute spent from the owner's month for each person in a call, at the start of each minute.
// With Pro off it does nothing: no storage, no alarm, no request.
export function newCallMeter(room: DocumentRoom): CallMeter {
  return new CallMeter({
    client: () => (room.roomEnv ? subscriptionClientOf(room.roomEnv, 'livehuddle.app') : null),
    now: () => Date.now(),
    load: () => room.state.storage.get<CallMeterState>(CALL_METER_KEY),
    save: (state) => void room.state.storage.put(CALL_METER_KEY, state),
    sessions: () => callSessionHolders(room),
    end: () => endCallSessions(room),
    tell: (op) => room.broadcast({ kind: 'op', from: 'system', op }),
    sever: async (sessionId) => {
      const env = room.roomEnv;
      if (env && callsConfigured(env)) await severSession(env as RealtimeEnv, sessionId);
    },
    arm: () => room.armAlarm(),
    defer: (work) => room.state.waitUntil(work),
  });
}

// A Participant's content and answers (docs/specs/013-workspace/share-roles.md), see room-participant.ts.
export function newParticipantWrites(room: DocumentRoom): RoomParticipantWrites {
  return new RoomParticipantWrites({
    env: room.roomEnv,
    enqueue: (step) => room.queueTabWrite(step),
    sequence: (from, op, except) => room.sequenceMutation(from, op, except),
    sendTo: (ws, payload) => room.sendTo(ws, payload),
    position: () => ({ epoch: room.epoch, seq: room.seq }),
    readLedger: (tabId) => room.ledger.read(tabId),
  });
}

// The surface the api worker's internal endpoints act on (room-internal.ts).
export function newInternalRoom(room: DocumentRoom): InternalRoom {
  return {
    broadcastSystemOp: (op) => room.broadcastSystemOp(op),
    closeSessionsOfChangedLink: (op) => room.closeSessionsOfChangedLink(op),
    closeAllIfTrashed: (op) => closeAllIfTrashed(room, op),
    clearAgentsFor: (op) => room.clearAgentsFor(op),
    closeSessionsForAccessChange: (close) => closeSessionsForAccessChange(room, close),
    purge: () => room.purge(),
    handleAgentPresence: (req, u) => handleAgentPresence(room, req, u),
    sequenceMutation: (from, op) => room.sequenceMutation(from, op),
    readSelections: (tabId, person) => room.selections.read(tabId, liveSessions(room), person),
    readLedger: (tabId, since) => room.ledger.read(tabId, since),
    epoch: () => room.epoch,
    renamePerson: (personTag, name) => renamePerson(room, personTag, name),
  };
}

// Who is running the session (docs/specs/012-collaboration/facilitator.md): the baton, restored by room-restore.ts.
export function newFacilitator(room: DocumentRoom): RoomFacilitator {
  return new RoomFacilitator({
    storage: room.state.storage,
    broadcast: (payload, except) => room.broadcast(payload, except),
    sendTo: (ws, payload) => room.sendTo(ws, payload),
    sendToPresence: (presenceId, payload) => room.sendToPresence(presenceId, payload),
    socketByPresence: (presenceId) => socketByPresence(room, presenceId),
    readSession: (ws) => room.readSession(ws),
    armAlarm: () => room.armAlarm(),
  });
}
