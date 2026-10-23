// Team calls (docs/specs/013-workspace/teams.md): list, create and read teams, the team library, and the
// assign-action and mention notices. Signed-in only on the server: every endpoint 401s without a
// verified Bearer token, so callers gate on `isSignedIn` before reaching for these. Administering a
// team (rename, delete, invites, roles, removal, invite links) happens on liveworkspace.app.
import type {
  Team,
  TeamInvite,
  TeamInviteLink,
  TeamLibraryResponse,
  TeamListItem,
  TeamMember,
  TeamRole,
  TeamsResponse,
} from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiHeaders, expectOk, apiFetch } from './core';

type TeamResponse = { team: Team };
export type TeamDetailResponse = {
  team: Team;
  members: TeamMember[];
  myRole: TeamRole;
  // The shareable invite link, admin-only and null when off / expired
  // (docs/specs/013-workspace/teams.md). Non-admins always receive null.
  inviteLink: TeamInviteLink | null;
};
type TeamInvitesResponse = { invites: TeamInvite[] };

// Same dedupe rationale as apiListFolders: the sidebar list is
// fetched once per surface, and concurrent mounts must not fan out
// duplicate GETs.
async function _apiListTeams(ownerId: string): Promise<TeamListItem[]> {
  const res = await apiFetch(`${API_BASE}/teams`, { headers: await apiHeaders(ownerId) });
  const { teams } = await expectOk<TeamsResponse>(res, 'list teams');
  return teams;
}
export const apiListTeams = dedupeInFlight(_apiListTeams, (ownerId) => ownerId);

// The caller's pending invites (docs/specs/013-workspace/teams.md accept/decline). Deduped for
// the same concurrent-mount reason as the list.
async function _apiListTeamInvites(ownerId: string): Promise<TeamInvite[]> {
  const res = await apiFetch(`${API_BASE}/teams/invites`, { headers: await apiHeaders(ownerId) });
  const { invites } = await expectOk<TeamInvitesResponse>(res, 'list team invites');
  return invites;
}
export const apiListTeamInvites = dedupeInFlight(_apiListTeamInvites, (ownerId) => ownerId);

// The team's shared library (docs/specs/013-workspace/team-shared-documents.md): folder tree + documents in one
// call, joined members only.
//
// Callers asking for the same library at the same time share one request (the Explorer's sweep, the team
// page and the placement options each ask on arrival); a later call reads afresh.
export const apiGetTeamLibrary = dedupeInFlight(
  fetchTeamLibrary,
  (ownerId, teamId) => `${ownerId}|${teamId}`,
);

async function fetchTeamLibrary(ownerId: string, teamId: string): Promise<TeamLibraryResponse> {
  const res = await apiFetch(`${API_BASE}/teams/${teamId}/library`, {
    headers: await apiHeaders(ownerId),
  });
  return expectOk<TeamLibraryResponse>(res, 'load team library');
}

export async function apiCreateTeam(
  ownerId: string,
  input: { name: string; organisation?: string | null },
): Promise<Team> {
  const res = await apiFetch(`${API_BASE}/teams`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      name: input.name,
      organisation: input.organisation ?? null,
    }),
  });
  const { team } = await expectOk<TeamResponse>(res, 'create team');
  return team;
}

export async function apiGetTeam(ownerId: string, id: string): Promise<TeamDetailResponse> {
  const res = await apiFetch(`${API_BASE}/teams/${id}`, { headers: await apiHeaders(ownerId) });
  return expectOk<TeamDetailResponse>(res, 'load team');
}

// Whether a joined teammate can open a document (docs/specs/012-collaboration/assigned-actions.md): drives the
// Assign Action dialog's access hint. Null on any failure so the caller
// can fall back to its heuristic instead of showing a confident wrong
// answer.
export async function apiCheckAssigneeAccess(
  ownerId: string,
  teamId: string,
  input: { assigneeUserId: string; documentId: string },
): Promise<boolean | null> {
  try {
    const params = new URLSearchParams({
      assigneeUserId: input.assigneeUserId,
      documentId: input.documentId,
    });
    const res = await apiFetch(`${API_BASE}/teams/${teamId}/access-check?${params}`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const { canAccess } = (await res.json()) as { canAccess?: boolean };
    return typeof canAccess === 'boolean' ? canAccess : null;
  } catch {
    return null;
  }
}

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
