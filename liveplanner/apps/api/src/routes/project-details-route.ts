// A plan's description (docs/specs/026-plan/plan-overview.md "The description"): PUT /api/projects/:id/details stores
// `{ description }` for anyone who may edit the whole plan (a grant confined to one tab may not), trimmed and capped
// (readProjectDescription), answers it as stored, and relays it to the plan's room as an ordered `project-details` op.
// Reading it is the project's GET (`description`).

import { readProjectDescription, type ProjectDetailsResponse } from '@liveplanner/api-schema';
import { getProject } from '../db';
import { setPlanDescription } from '../plan-room/plan-content';
import { badRequest, forbidden, json, methodNotAllowed } from '../responses';
import { relayProjectDetails } from '../room-client';
import { gateEdit, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

async function put(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  // The description is the whole plan's: a grant confined to one tab may not change it.
  if (!(await gateEdit(ctx, projectId, doc.ownerId, doc.teamId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (typeof body.description !== 'string') {
    console.info('[project-details] details.rejected', { reason: 'not_text' });
    return badRequest('expected { description }');
  }
  const description = readProjectDescription(body.description);
  if (!(await setPlanDescription(ctx.env, projectId, description)))
    return missingProject(ctx, projectId);
  console.info('[project-details] details.saved', { length: description.length });
  ctx.waitUntil?.(
    relayProjectDetails(ctx.env, projectId, { kind: 'project-details', description }),
  );
  const answer: ProjectDetailsResponse = { description };
  return json(answer);
}

export async function handleProjectDetailsRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'details') return null;
  const projectId = segments[2]!;
  return request.method === 'PUT' ? put(ctx, projectId) : methodNotAllowed();
}
