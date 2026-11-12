// A team's people, and the assignment and mention emails (docs/specs/012-collaboration/assigned-actions.md,
// comment-mentions.md). Teams are liveworkspace's; the api reads their people from the accounts Worker for a
// caller whose token names the team. Signed-in only: every endpoint refuses without a verified Bearer token, so
// callers gate on `isSignedIn` before reaching for these. Administering a team happens on liveworkspace.app.
import type { TeamMember } from '@livehuddle/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export type { TeamMember };

// The team's joined and invited people, for someone in it. Concurrent asks for the same team share one request
// (the assignee picker and the mention list open together).
async function _apiTeamMembers(ownerId: string, teamId: string): Promise<TeamMember[]> {
  const res = await apiFetch(`${API_BASE}/teams/${encodeURIComponent(teamId)}/members`, {
    headers: await apiHeaders(ownerId),
  });
  return (await expectOk<{ members: TeamMember[] }>(res, 'load team members')).members;
}

export const apiTeamMembers = dedupeInFlight(
  _apiTeamMembers,
  (ownerId, teamId) => `${ownerId} ${teamId}`,
);
