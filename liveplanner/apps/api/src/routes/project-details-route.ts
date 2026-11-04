// A plan's details (docs/specs/026-plan/plan-overview.md "The description", "The Overview's style"): PUT
// /api/projects/:id/details stores `{ description }`, `{ overviewStyle }` or both for anyone who may edit the whole
// plan (a grant confined to one tab may not), each through its one normaliser (readProjectDescription,
// readOverviewStyle), answers what it wrote as stored, and relays it to the plan's room as an ordered
// `project-details` op. Reading them is the project's GET (`description`, `overviewStyle`).

import {
  readOverviewStyle,
  readProjectDescription,
  type ProjectDetailsResponse,
} from '@liveplanner/api-schema';
import { getProject } from '../db';
import { setPlanDescription, setPlanOverviewStyle } from '../plan-room/plan-content';
import { badRequest, forbidden, json, methodNotAllowed } from '../responses';
import { relayProjectDetails } from '../room-client';
import { gateEdit, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

// What the body asks to write, or why it cannot be read.
function readDetails(body: Record<string, unknown>): ProjectDetailsResponse | string {
  const hasDescription = 'description' in body;
  const hasStyle = 'overviewStyle' in body;
  if (!hasDescription && !hasStyle) return 'empty';
  if (hasDescription && typeof body.description !== 'string') return 'not_text';
  const style = body.overviewStyle;
  if (hasStyle && style !== null && (typeof style !== 'object' || Array.isArray(style)))
    return 'not_style';
  return {
    ...(hasDescription ? { description: readProjectDescription(body.description) } : {}),
    ...(hasStyle ? { overviewStyle: readOverviewStyle(style) } : {}),
  };
}

async function put(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  // The details are the whole plan's: a grant confined to one tab may not change them.
  if (!(await gateEdit(ctx, projectId, doc.ownerId, doc.teamId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const details = readDetails(body);
  if (typeof details === 'string') {
    console.info('[project-details] details.rejected', { reason: details });
    return badRequest('expected { description } or { overviewStyle }');
  }
  const { description, overviewStyle } = details;
  if (description !== undefined && !(await setPlanDescription(ctx.env, projectId, description)))
    return missingProject(ctx, projectId);
  if (
    overviewStyle !== undefined &&
    !(await setPlanOverviewStyle(ctx.env, projectId, overviewStyle))
  )
    return missingProject(ctx, projectId);
  console.info('[project-details] details.saved', {
    ...(description !== undefined ? { length: description.length } : {}),
    ...(overviewStyle !== undefined ? { style: overviewStyle ? 'set' : 'cleared' } : {}),
  });
  ctx.waitUntil?.(relayProjectDetails(ctx.env, projectId, { kind: 'project-details', ...details }));
  return json(details);
}

export async function handleProjectDetailsRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'details') return null;
  const projectId = segments[2]!;
  return request.method === 'PUT' ? put(ctx, projectId) : methodNotAllowed();
}
