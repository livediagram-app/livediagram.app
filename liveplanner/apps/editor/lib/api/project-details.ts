// A plan's details on the wire (docs/specs/026-plan/plan-overview.md "The description", "The Overview's style"): PUT
// /projects/:id/details for a cloud plan, the record for an offline one. Each answers what it wrote as stored.

import {
  readOverviewStyle,
  readProjectDescription,
  type OverviewStyle,
  type ProjectDetailsResponse,
} from '@liveplanner/api-schema';
import {
  isOfflineId,
  offlineSaveDescription,
  offlineSaveOverviewStyle,
} from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

type Scope = { ownerId: string; projectId: string; shareCode: string | null };

async function putDetails(scope: Scope, body: ProjectDetailsResponse) {
  const res = await apiFetch(
    `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/details`,
    {
      method: 'PUT',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify(body),
    },
  );
  return expectOk<ProjectDetailsResponse>(res, 'details');
}

export async function saveProjectDescription(scope: Scope, description: string): Promise<string> {
  const value = readProjectDescription(description);
  if (await isOfflineId(scope.projectId)) {
    await offlineSaveDescription(scope.projectId, value, Date.now());
    return value;
  }
  const answer = await putDetails(scope, { description: value });
  return readProjectDescription(answer.description);
}

// The Overview's style; null clears it (the Overview then wears its first tab's).
export async function saveOverviewStyle(
  scope: Scope,
  style: OverviewStyle | null,
): Promise<OverviewStyle | null> {
  const value = readOverviewStyle(style);
  if (await isOfflineId(scope.projectId)) {
    await offlineSaveOverviewStyle(scope.projectId, value, Date.now());
    return value;
  }
  const answer = await putDetails(scope, { overviewStyle: value });
  return readOverviewStyle(answer.overviewStyle);
}
