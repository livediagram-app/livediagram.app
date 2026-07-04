// Team calls (spec/32): list / create / read / update / delete, plus
// member invite / role change / remove. Clerk-only on the server: every
// endpoint 401s without a verified Bearer token, so callers gate on
// `isSignedIn` before reaching for these. The mutations that have
// legitimate business-rule rejections (duplicate invite, last-admin
// guard) return discriminated results instead of throwing, because the
// UI has to message them ("Already on this team") rather than treat
// them as transport failures.
import type {
  DiagramSummary,
  Folder,
  Team,
  TeamInvite,
  TeamInviteLink,
  TeamInviteLinkInfo,
  TeamInviteLinkJoin,
  TeamListItem,
  TeamMember,
  TeamRole,
} from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiDelete, apiHeaders, expectOk } from './core';

type TeamsResponse = { teams: TeamListItem[] };
type TeamResponse = { team: Team };
export type TeamDetailResponse = {
  team: Team;
  members: TeamMember[];
  myRole: TeamRole;
  // The shareable invite link, admin-only and null when off / expired
  // (spec/32). Non-admins always receive null.
  inviteLink: TeamInviteLink | null;
};
type TeamMemberResponse = { member: TeamMember };
type TeamInvitesResponse = { invites: TeamInvite[] };
export type TeamLibraryResponse = { folders: Folder[]; diagrams: DiagramSummary[] };

// Same dedupe rationale as apiListFolders: the sidebar list is
// fetched once per surface, and concurrent mounts must not fan out
// duplicate GETs.
async function _apiListTeams(ownerId: string): Promise<TeamListItem[]> {
  const res = await fetch(`${API_BASE}/teams`, { headers: await apiHeaders(ownerId) });
  const { teams } = await expectOk<TeamsResponse>(res, 'list teams');
  return teams;
}
export const apiListTeams = dedupeInFlight(_apiListTeams, (ownerId) => ownerId);

// The caller's pending invites (spec/32 accept/decline). Deduped for
// the same concurrent-mount reason as the list.
async function _apiListTeamInvites(ownerId: string): Promise<TeamInvite[]> {
  const res = await fetch(`${API_BASE}/teams/invites`, { headers: await apiHeaders(ownerId) });
  const { invites } = await expectOk<TeamInvitesResponse>(res, 'list team invites');
  return invites;
}
export const apiListTeamInvites = dedupeInFlight(_apiListTeamInvites, (ownerId) => ownerId);

// The invitee's yes: flips their own member row from invited to
// joined. Declining is apiRemoveTeamMember on the same row.
export async function apiAcceptTeamInvite(
  ownerId: string,
  teamId: string,
  memberId: string,
): Promise<TeamMember> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/members/${memberId}/accept`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  const { member } = await expectOk<TeamMemberResponse>(res, 'accept team invite');
  return member;
}

// The team's shared library (spec/35): folder tree + diagrams in one
// call, joined members only.
export async function apiGetTeamLibrary(
  ownerId: string,
  teamId: string,
): Promise<TeamLibraryResponse> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/library`, {
    headers: await apiHeaders(ownerId),
  });
  return expectOk<TeamLibraryResponse>(res, 'load team library');
}

export async function apiCreateTeam(
  ownerId: string,
  input: { id: string; name: string; organisation?: string | null },
): Promise<Team> {
  const res = await fetch(`${API_BASE}/teams`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      organisation: input.organisation ?? null,
    }),
  });
  const { team } = await expectOk<TeamResponse>(res, 'create team');
  return team;
}

export async function apiGetTeam(ownerId: string, id: string): Promise<TeamDetailResponse> {
  const res = await fetch(`${API_BASE}/teams/${id}`, { headers: await apiHeaders(ownerId) });
  return expectOk<TeamDetailResponse>(res, 'load team');
}

export async function apiUpdateTeam(
  ownerId: string,
  id: string,
  patch: { name?: string; organisation?: string | null },
): Promise<Team> {
  const res = await fetch(`${API_BASE}/teams/${id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { team } = await expectOk<TeamResponse>(res, 'update team');
  return team;
}

export async function apiDeleteTeam(ownerId: string, id: string): Promise<void> {
  return apiDelete(`${API_BASE}/teams/${id}`, ownerId, { action: 'delete team' });
}

export type InviteTeamMemberResult =
  | { ok: true; member: TeamMember }
  | { ok: false; reason: 'already_member' | 'invalid_email' };

export async function apiInviteTeamMember(
  ownerId: string,
  teamId: string,
  email: string,
): Promise<InviteTeamMemberResult> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/members`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ email }),
  });
  if (res.status === 409) return { ok: false, reason: 'already_member' };
  if (res.status === 400) return { ok: false, reason: 'invalid_email' };
  const { member } = await expectOk<TeamMemberResponse>(res, 'invite team member');
  return { ok: true, member };
}

export type TeamMemberMutationResult = { ok: true } | { ok: false; reason: 'last_admin' };

export async function apiUpdateTeamMemberRole(
  ownerId: string,
  teamId: string,
  memberId: string,
  role: TeamRole,
): Promise<TeamMemberMutationResult> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/members/${memberId}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ role }),
  });
  if (res.status === 409) return { ok: false, reason: 'last_admin' };
  if (!res.ok) throw new Error(`change team role failed: ${res.status}`);
  return { ok: true };
}

export async function apiRemoveTeamMember(
  ownerId: string,
  teamId: string,
  memberId: string,
): Promise<TeamMemberMutationResult> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE',
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 409) return { ok: false, reason: 'last_admin' };
  if (!res.ok && res.status !== 404) throw new Error(`remove team member failed: ${res.status}`);
  return { ok: true };
}

// Whether a joined teammate can open a diagram (spec/68): drives the
// Assign Action dialog's access hint. Null on any failure so the caller
// can fall back to its heuristic instead of showing a confident wrong
// answer.
export async function apiCheckAssigneeAccess(
  ownerId: string,
  teamId: string,
  input: { assigneeUserId: string; diagramId: string },
): Promise<boolean | null> {
  try {
    const params = new URLSearchParams({
      assigneeUserId: input.assigneeUserId,
      diagramId: input.diagramId,
    });
    const res = await fetch(`${API_BASE}/teams/${teamId}/access-check?${params}`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const { canAccess } = (await res.json()) as { canAccess?: boolean };
    return typeof canAccess === 'boolean' ? canAccess : null;
  } catch {
    return null;
  }
}

// Email a teammate about an action just assigned to them (spec/68).
// Best-effort by contract: the assignment has already persisted via the
// tab write, so callers fire-and-forget this and swallow failures. The
// server re-verifies team membership + diagram access and resolves every
// name/address itself; the body only says who and what.
export async function apiNotifyActionAssigned(
  ownerId: string,
  teamId: string,
  input: {
    // One of the two keys: userId for identified members, memberId (the
    // membership row id) for invited members with no account yet.
    assigneeUserId: string | null;
    assigneeMemberId?: string;
    diagramId: string;
    actionName: string;
    description?: string;
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/notify-action`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  await expectOk<{ ok: boolean }>(res, 'notify assigned action');
}

// --- Shareable invite link (spec/32) ----------------------------------

// Admin: turn the link on (or rotate it), getting back the fresh token
// + its 1-week expiry.
export async function apiGenerateTeamInviteLink(
  ownerId: string,
  teamId: string,
): Promise<TeamInviteLink> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/invite-link`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  const { inviteLink } = await expectOk<{ inviteLink: TeamInviteLink }>(
    res,
    'generate team invite link',
  );
  return inviteLink;
}

// Admin: turn the link off.
export async function apiRevokeTeamInviteLink(ownerId: string, teamId: string): Promise<void> {
  return apiDelete(`${API_BASE}/teams/${teamId}/invite-link`, ownerId, {
    action: 'revoke team invite link',
  });
}

// Resolve a join token to its team (the /join landing). Guest-callable.
// Null when the token is unknown / turned off / expired.
export async function apiResolveTeamInviteLink(
  ownerId: string,
  token: string,
): Promise<TeamInviteLinkInfo | null> {
  const res = await fetch(`${API_BASE}/teams/invite-link/${encodeURIComponent(token)}`, {
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 404) return null;
  return expectOk<TeamInviteLinkInfo>(res, 'resolve team invite link');
}

// Join via the link (signed-in only on the server). Null when the token
// is no longer valid by the time the user clicks Join.
export async function apiJoinTeamByInviteLink(
  ownerId: string,
  token: string,
): Promise<TeamInviteLinkJoin | null> {
  const res = await fetch(`${API_BASE}/teams/invite-link/${encodeURIComponent(token)}/join`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  if (res.status === 404) return null;
  return expectOk<TeamInviteLinkJoin>(res, 'join team by invite link');
}
