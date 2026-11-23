// What the room restores on every wake (plan-room.ts's constructor), before any request can observe its `epoch` and
// `seq`: a wake re-runs the constructor, so without this gate a socket could be handed the freshly minted values and
// defeat the ordering. Then the agents, the standing, the content's upkeep state and whether the plan was purged.
import { agentPresenceLog } from '@liveworkspace/api-kit/room-agent-presence';
import type { PlanRoom } from './plan-room';
import { MAINTENANCE_KEY, restoreContentState } from './plan-room-content';
import { purgedAt } from './plan-room-purged';
import { ORDER_STATE_KEY } from './plan-room-sockets';
import { STANDING_KEY } from './plan-standing';

export async function restoreRoom(room: PlanRoom): Promise<void> {
  const { storage } = room.state;
  const saved = await storage.get<{ epoch: string; seq: number }>(ORDER_STATE_KEY);
  if (saved) {
    room.epoch = saved.epoch;
    room.seq = saved.seq;
  } else {
    // First instantiation for this project: adopt the random epoch the constructor drew.
    await storage.put(ORDER_STATE_KEY, { epoch: room.epoch, seq: room.seq });
  }
  for (const r of await room.agents.restore()) agentPresenceLog('expired', r);
  // Before the schedules restore, so a plan put away asks for no wake.
  room.standing.restore(await storage.get(STANDING_KEY));
  restoreContentState(room, await storage.get<number>(MAINTENANCE_KEY));
  // A room with no plan schema learns whether it was purged before any door runs (plan-room-purged.ts); a plan
  // with content reads nothing more.
  await purgedAt(room);
  room.armAlarm();
}
