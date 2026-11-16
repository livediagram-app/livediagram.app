// A plan's public roadmaps as Publish as Roadmap manages them (docs/specs/026-plan/public-roadmap.md "Managing a
// roadmap"), typed with @liveplanner/api-schema. Never through a share link: the dialog opens only for the plan's
// owner or a team member (roadmap-gate.ts).
import type { RoadmapResponse, RoadmapSettings, RoadmapsResponse } from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';
import type { RoadmapScope } from './roadmap-gate';

const url = (scope: RoadmapScope, boardId?: string) =>
  `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/roadmaps${
    boardId ? `/${encodeURIComponent(boardId)}` : ''
  }`;

async function call(
  scope: RoadmapScope,
  method: string,
  boardId?: string,
  body?: RoadmapSettings,
): Promise<Response> {
  return apiFetch(url(scope, boardId), {
    method,
    headers: await apiHeaders(scope.ownerId, { share: null, body: body !== undefined }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** The plan's published roadmaps, the boards that may be published and the forms that may take suggestions. */
export async function readRoadmaps(scope: RoadmapScope): Promise<RoadmapsResponse> {
  return expectOk<RoadmapsResponse>(await call(scope, 'GET'), 'read roadmaps');
}

/** Publish the board, or change its published roadmap's settings (the link kept). */
export async function saveRoadmap(
  scope: RoadmapScope,
  boardId: string,
  settings: RoadmapSettings,
): Promise<RoadmapResponse> {
  return expectOk<RoadmapResponse>(await call(scope, 'PUT', boardId, settings), 'save roadmap');
}

/** Unpublish: the link stops at once. */
export async function unpublishRoadmap(scope: RoadmapScope, boardId: string): Promise<void> {
  return expectOkVoid(await call(scope, 'DELETE', boardId), 'unpublish roadmap');
}
