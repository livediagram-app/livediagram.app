// /api/roadmaps/:planId/:code[/votes]: a public roadmap's doors in the worker (docs/specs/026-plan/public-roadmap.md
// "How it answers"). The worker's limits have already run (index.ts: per network, apart from everyone's project
// writes); here the path's shape (404) and the method (405) are checked, and the request goes to that plan's room,
// which answers it as no one (plan-room.ts `roadmap`, ../roadmap/roadmap-public.ts): there every unknown code,
// unpublished roadmap or plan gone answers the same `roadmap_not_found`. A path that cannot be one never wakes a room.
import { planRoom } from '../plan-client';
import { methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';

const PLAN_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function handleRoadmaps(ctx: RouteContext): Promise<Response> {
  const { segments } = ctx;
  const { method } = ctx.request;
  const planId = segments[2] ?? '';
  if (!PLAN_ID.test(planId) || !segments[3]) return Promise.resolve(notFound());
  if (segments.length === 4) {
    if (method !== 'GET') return Promise.resolve(methodNotAllowed());
  } else if (segments.length === 5 && segments[4] === 'votes') {
    if (method !== 'POST') return Promise.resolve(methodNotAllowed());
  } else {
    return Promise.resolve(notFound());
  }
  return planRoom(ctx.env, planId).roadmap(ctx.request);
}
