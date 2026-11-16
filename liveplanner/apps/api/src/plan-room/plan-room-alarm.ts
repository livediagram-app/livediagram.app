// The plan room's one alarm (plan-room.ts `armAlarm` and `alarm`): when it next wakes, and what a wake runs. Moved out
// of the class so the room stays a list of doors; the order of the work is unchanged.
import { agentPresenceLog } from '@liveworkspace/api-kit/room-agent-presence';
import { armRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import { runAutomations } from './automations/plan-room-automations';
import type { PlanRoom } from './plan-room';
import { checkCommunity, drainIndex, drainShares, maintain, runRepeats } from './plan-room-content';
import { checkGrants, nextGrantDue } from './plan-room-grants';

/** The alarm set at the earliest of: an agent presence expiry (agent-presence I5, PR29), the outbox's next push, the
 *  Community post's next check, the plan's next upkeep, a repeating card's next copy, a rule's next run, a grant's
 *  renewal. None when nothing is due. */
export function armPlanAlarm(room: PlanRoom): void {
  const due = [
    room.agents.nextExpiry(),
    room.flushAt,
    room.shares.at,
    room.communityAt,
    room.maintenanceAt,
    room.repeats.at,
    room.automations.schedule.wakeAt,
    nextGrantDue(room),
  ];
  // Never sooner than a second from now, and no write when it already stands there (api-kit room-alarm.ts).
  armRoomAlarm(room.state.storage, due, Date.now());
}

/** Agent entries past their expiry go; the outbox pushes and the upkeep runs when due. Safe to call early. */
export async function wakePlanRoom(room: PlanRoom): Promise<void> {
  const expired = await room.agents.sweep();
  for (const r of expired) agentPresenceLog('expired', r);
  if (expired.length > 0) room.broadcastPresence();
  const now = Date.now();
  checkGrants(room, now);
  // Put away while a wake was running: what it asked for is dropped, so the alarm stops asking.
  if (room.standing.putAway) {
    room.repeats.clear();
    room.automations.schedule.clear();
  }
  if (room.repeats.due(now)) await runRepeats(room, now);
  if (room.automations.schedule.due(now)) await runAutomations(room, now);
  if (room.flushAt !== null && room.flushAt <= now) await drainIndex(room);
  // A shared tab written while the push was in flight (its write armed nothing then).
  room.shares.noteWrite();
  if (room.shares.due(now)) await drainShares(room);
  if (room.communityAt !== null && room.communityAt <= now) await checkCommunity(room, now);
  if (room.maintenanceAt !== null && room.maintenanceAt <= now) await maintain(room, now);
  armPlanAlarm(room);
}
