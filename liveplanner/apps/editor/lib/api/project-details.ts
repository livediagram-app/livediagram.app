// A plan's description on the wire (docs/specs/026-plan/plan-overview.md "The description"): PUT
// /projects/:id/details for a cloud plan, the record for an offline one. Answers the description as stored.

import { readProjectDescription, type ProjectDetailsResponse } from '@liveplanner/api-schema';
import { isOfflineId, offlineSaveDescription } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export async function saveProjectDescription(
  scope: { ownerId: string; projectId: string; shareCode: string | null },
  description: string,
): Promise<string> {
  const value = readProjectDescription(description);
  if (await isOfflineId(scope.projectId)) {
    await offlineSaveDescription(scope.projectId, value, Date.now());
    return value;
  }
  const res = await apiFetch(
    `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/details`,
    {
      method: 'PUT',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify({ description: value }),
    },
  );
  const answer = await expectOk<ProjectDetailsResponse>(res, 'details');
  return readProjectDescription(answer.description);
}
