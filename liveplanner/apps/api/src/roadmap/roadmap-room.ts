// A public roadmap's door into the plan's room (docs/specs/026-plan/public-roadmap.md "How it answers"): the room's
// `roadmap` RPC (plan-room.ts) hands each visitor's read or vote here, answered as no one (roadmap-public.ts).
import { bindStoredPlan, noteWrite } from '../plan-room/plan-room-content';
import type { PlanRoom } from '../plan-room/plan-room';
import { ANONYMOUS, answerPlanRequest } from '../plan-room/plan-route';
import { roadmapMissed } from './roadmap-answer';

// An id nothing has written, or a plan archived or in the Trash, answers the same 404 as an unknown code and stays
// empty; a vote that may have written tells the outbox.
export async function answerRoomRoadmap(
  room: PlanRoom,
  planId: string,
  request: Request,
): Promise<Response> {
  if (!bindStoredPlan(room, planId) || room.standing.putAway) return roadmapMissed('no_plan');
  const response = await answerPlanRequest(room.requireEnv(), request, ANONYMOUS, (p) =>
    room.state.waitUntil(p),
  );
  if (request.method === 'POST' && response.ok) noteWrite(room);
  return response;
}
