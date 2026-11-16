// The plan room's side of Email to Board (plan-room.ts `emailIntake`): one message to a board's address, delivered
// against the room's own storage and env. An id nothing has written answers `gone` and stays empty.
import type { PlanRoom } from '../plan-room/plan-room';
import { bindStoredPlan, noteWrite } from '../plan-room/plan-room-content';
import { recordImageGrant } from '../plan-room/image-grants';
import { deliverIntake, type IntakeDelivery, type IntakeOutcome } from './intake-delivery';

export type { IntakeDelivery, IntakeOutcome };

export function answerRoomIntake(
  room: PlanRoom,
  planId: string,
  delivery: IntakeDelivery,
): Promise<IntakeOutcome> {
  if (!bindStoredPlan(room, planId)) return Promise.resolve('gone');
  const sql = room.state.storage.sql;
  return deliverIntake(
    {
      env: room.requireEnv(),
      putAway: room.standing.putAway,
      grant: (imageId) => recordImageGrant(sql, planId, imageId, Date.now()),
      wrote: () => noteWrite(room),
      waitUntil: (p) => room.state.waitUntil(p),
    },
    planId,
    delivery,
    Date.now(),
  );
}
