// A team's people, and the assignment email (docs/specs/012-collaboration/assigned-actions.md,
// comment-mentions.md). Teams are liveworkspace's; the api reads their people from the accounts Worker for a
// caller whose token names the team.
import type { TeamMember } from '@liveplanner/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

export type { TeamMember };

// The team's joined and invited people, for someone in it. Concurrent asks for the same team share one request
// (the assignee picker and the mention list open together).
async function _apiTeamMembers(ownerId: string, teamId: string): Promise<TeamMember[]> {
  const res = await apiFetch(`${API_BASE}/teams/${encodeURIComponent(teamId)}/members`, {
    headers: await apiHeaders(ownerId),
  });
  return (await expectOk<{ members: TeamMember[] }>(res, 'load team members')).members;
}

export const apiTeamMembers = dedupeInFlight(_apiTeamMembers, (ownerId, teamId) => `${ownerId} ${teamId}`);

// Email a teammate about an action just assigned to them on this plan. Best-effort: the assignment is already
// saved, so callers fire and forget. The api checks the team, the plan and the assignee, and resolves every name
// and address itself.
export async function apiNotifyActionAssigned(
  ownerId: string,
  projectId: string,
  input: {
    teamId: string;
    // One of the two keys: userId for someone with an account, memberId (the membership row) for an
    // invitation with none yet.
    assigneeUserId: string | null;
    assigneeMemberId?: string;
    actionName: string;
    description?: string;
  },
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/notify-action`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  await expectOkVoid(res, 'notify assigned action');
}
