// What the room's constructor (document-room.ts) wires up, apart from its content: the item's tier, the surface the
// api worker's internal endpoints act on, and the facilitator's baton. Each takes the room.
import { roomTier } from '@liveworkspace/automations/room';
import type { ItemTier } from '@liveworkspace/subscription';
import { ledgerEntryKeys } from '@livediagram/document';
import { RoomFacilitator } from '../room-facilitator';
import type { InternalRoom } from '../room-internal';
import type { DocumentRoom } from './document-room';
import { handleAgentPresence, liveSessions, socketByPresence } from './room-roster';
import { closeAllIfTrashed, closeSessionsForAccessChange } from './room-sockets';

// The item's tier (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an item"): read from the
// diagram's owner. With Pro off it asks nothing and every limit is the legacy one.
export function newRoomTier(room: DocumentRoom): ItemTier {
  return roomTier({
    app: 'livediagram.app',
    env: () => room.roomEnv ?? null,
    sql: () => room.state.storage.sql,
    ready: () => room.schemaReady,
    table: 'document',
    id: () => room.documentId,
    defer: (work) => room.state.waitUntil(work),
  });
}

// The surface the api worker's internal endpoints act on (room-internal.ts).
export function newInternalRoom(room: DocumentRoom): InternalRoom {
  return {
    broadcastSystemOp: (op) => room.broadcastSystemOp(op),
    broadcastOrderedSystemOp: (op) => room.broadcastOrderedSystemOp(op),
    closeSessionsOfChangedLink: (op) => room.closeSessionsOfChangedLink(op),
    closeAllIfTrashed: (op) => closeAllIfTrashed(room, op),
    clearAgentsFor: (op) => room.clearAgentsFor(op),
    closeSessionsForAccessChange: (close) => closeSessionsForAccessChange(room, close),
    purge: () => room.purge(),
    handleAgentPresence: (req, u) => handleAgentPresence(room, req, u),
    handleQaWrite: (req) => room.handleQaWrite(req),
    sequenceMutation: (from, op) => room.sequenceMutation(from, op),
    readSelections: (tabId, person) => room.selections.read(tabId, liveSessions(room), person),
    readLedger: (tabId, since) => room.ledger.read(tabId, since),
    readLedgerEntries: (tabId, want) => room.ledger.readKeys(tabId, ledgerEntryKeys(tabId, want)),
    epoch: () => room.epoch,
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
