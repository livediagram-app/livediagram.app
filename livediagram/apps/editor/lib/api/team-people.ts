// A team's people, and the assignment and mention emails (docs/specs/012-collaboration/assigned-actions.md,
// comment-mentions.md). Teams are liveworkspace's; the api reads their people from the accounts Worker for a
// caller whose token names the team. Signed-in only: every endpoint refuses without a verified Bearer token, so
// callers gate on `isSignedIn` before reaching for these. Administering a team happens on liveworkspace.app.
import type { TeamMember } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
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

// Email a teammate about an action just assigned to them (docs/specs/012-collaboration/assigned-actions.md).
// Best-effort by contract: the assignment has already persisted via the
// tab write, so callers fire-and-forget this and swallow failures. The
// server re-verifies team membership + document access and resolves every
// name/address itself; the body only says who and what.
export async function apiNotifyActionAssigned(
  ownerId: string,
  teamId: string,
  input: {
    // One of the two keys: userId for identified members, memberId (the
    // membership row id) for invited members with no account yet.
    assigneeUserId: string | null;
    assigneeMemberId?: string;
    documentId: string;
    actionName: string;
    description?: string;
  },
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/teams/${teamId}/notify-action`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  await expectOk<{ ok: boolean }>(res, 'notify assigned action');
}

// Email the teammates a comment just @-mentioned (docs/specs/012-collaboration/comment-mentions.md "The email").
// Best-effort like notify-action: the comment has already persisted, so
// callers fire-and-forget. The server re-verifies the team, the document and
// every recipient, and resolves every name and address itself.
export async function apiNotifyMention(
  ownerId: string,
  teamId: string,
  input: {
    documentId: string;
    commentText: string;
    mentions: { userId: string | null; memberId?: string }[];
  },
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/teams/${teamId}/notify-mention`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  await expectOk<{ ok: boolean }>(res, 'notify mention');
}
