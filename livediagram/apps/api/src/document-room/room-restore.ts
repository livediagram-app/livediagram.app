// What a room restores on every wake, before any request can observe its `epoch` and `seq`: a wake re-runs the
// constructor, so without this gate a socket could be handed the freshly minted values and defeat the ordering. Then
// the facilitator, the poll, the agents, the standing, the content's maintenance state and the service status.
import { agentPresenceLog } from '@liveworkspace/api-kit/room-agent-presence';
import type { DocumentRoom } from './document-room';
import { MAINTENANCE_KEY, restoreContentState } from './room-content-state';

// DO storage key holding `{ epoch, seq }` so the room keeps its ordering identity across a hibernation wake
// (docs/specs/012-collaboration/resync-without-reload.md).
export const ORDER_STATE_KEY = 'order-state';

export async function restoreRoom(room: DocumentRoom): Promise<void> {
  const { storage } = room.state;
  const saved = await storage.get<{ epoch: string; seq: number }>(ORDER_STATE_KEY);
  if (saved) {
    room.epoch = saved.epoch;
    room.seq = saved.seq;
  } else {
    // First instantiation for this document: adopt the random epoch the constructor drew.
    await storage.put(ORDER_STATE_KEY, { epoch: room.epoch, seq: room.seq });
  }
  await room.baton.restore();
  await room.poll.restore();
  for (const r of await room.agents.restore()) agentPresenceLog('expired', r);
  room.standing.restore(await storage.get(room.standing.key));
  restoreContentState(room, await storage.get<number>(MAINTENANCE_KEY));
  await room.serviceStatus.restore();
  room.armAlarm();
}
