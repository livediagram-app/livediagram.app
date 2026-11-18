// What the room's constructor (design-room.ts) wires up: the env's DESIGN_ROOM answering this object's own id,
// the design's owner and team kept from its grants, a Participant's writes, and the surface the internal endpoints act
// on. Each takes the room.
import { createItemHeadSync, type ItemHeadSync } from '@liveworkspace/index-app';
import { RoomParticipantWrites } from '../room-participant';
import { type InternalRoom } from '../room-internal';
import type { DesignRoom } from './design-room';
import { ensureSchema, noteWrite } from './design-room-content';
import {
  closeSessionsOfChangedLink,
  closeSessionsForAccessChange,
  closeAllIfTrashed,
  sequenceMutation,
  sendTo,
} from './design-room-sockets';
import { handleAgentPresence, clearAgentsFor, liveSessions } from './design-room-presence';

// This env's DESIGN_ROOM, answering this design's own id with this object: the code shared with the worker (a
// design read's outline, the room relays) then calls straight in rather than through a stub.
export function localNamespace(
  room: DesignRoom,
  real: DurableObjectNamespace<DesignRoom> | undefined,
): DurableObjectNamespace<DesignRoom> {
  const ns = (real ?? {}) as DurableObjectNamespace<DesignRoom>;
  return new Proxy(ns, {
    get: (target, prop, receiver) => {
      if (prop === 'get') {
        return (id: DurableObjectId, opts?: DurableObjectNamespaceGetDurableObjectOptions) =>
          id.equals(room.state.id) ? room : target.get(id, opts);
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

// The design's owner and team as its own row keeps them (@liveworkspace/index-app item-head.ts).
export function roomHead(room: DesignRoom): ItemHeadSync {
  const state = room.state;
  return createItemHeadSync({
    read: async () => {
      if (room.designId === null) return null;
      ensureSchema(room);
      const row = state.storage.sql
        .exec<{ owner_id: string | null; team_id: string | null }>(
          'SELECT owner_id, team_id FROM design WHERE id = ? AND created_at > 0',
          room.designId,
        )
        .toArray()[0];
      return row ? { ownerId: row.owner_id ?? '', teamId: row.team_id ?? null } : null;
    },
    write: async (h) => {
      state.storage.sql.exec(
        'UPDATE design SET owner_id = ?, team_id = ? WHERE id = ?',
        h.ownerId,
        h.teamId,
        room.designId,
      );
      console.info('[room] owner or team taken from the grant', { team: h.teamId !== null });
      noteWrite(room);
      // A new owner or team can open or close a Community post: it asks where it stands now.
      if (room.communityAt !== null) room.communityAt = Date.now();
    },
  });
}

// A Participant's writes on the room's tab write queue and ordered stream (room-participant.ts).
export function roomParticipantWrites(room: DesignRoom): RoomParticipantWrites {
  return new RoomParticipantWrites({
    env: room.roomEnv,
    enqueue: (step) => room.queueTabWrite(step),
    sequence: (from, op, except) => sequenceMutation(room, from, op, except),
    sendTo: (ws, payload) => sendTo(room, ws, payload),
    position: () => ({ epoch: room.epoch, seq: room.seq }),
  });
}

// The room's surface the api worker's internal endpoints act on (room-internal.ts).
export function roomInternal(room: DesignRoom): InternalRoom {
  return {
    broadcastSystemOp: (op) => room.broadcastSystemOp(op),
    closeSessionsOfChangedLink: (op) => closeSessionsOfChangedLink(room, op),
    closeAllIfTrashed: (op) => closeAllIfTrashed(room, op),
    clearAgentsFor: (op) => clearAgentsFor(room, op),
    closeSessionsForAccessChange: (close) => closeSessionsForAccessChange(room, close),
    purge: () => room.purge(),
    handleAgentPresence: (req, u) => handleAgentPresence(room, req, u),
    sequenceMutation: (from, op) => sequenceMutation(room, from, op),
    readSelections: (tabId, person) => room.selections.read(tabId, liveSessions(room), person),
    readLedger: (tabId, since) => room.ledger.read(tabId, since),
    epoch: () => room.epoch,
  };
}
