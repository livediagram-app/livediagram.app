// Team calls (spec/32): list / create / read / update / delete, plus
// member invite / role change / remove. Clerk-only on the server: every
// endpoint 401s without a verified Bearer token, so callers gate on
// `isSignedIn` before reaching for these. The mutations that have
// legitimate business-rule rejections (duplicate invite, last-admin
// guard) return discriminated results instead of throwing, because the
// UI has to message them ("Already on this team") rather than treat
// them as transport failures.
import type { Team, TeamListItem, TeamMember, TeamRole } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiDelete, apiHeaders, expectOk } from './core';

export type TeamsResponse = { teams: TeamListItem[] };
export type TeamResponse = { team: Team };
export type TeamDetailResponse = { team: Team; members: TeamMember[]; myRole: TeamRole };
export type TeamMemberResponse = { member: TeamMember };

// Same dedupe rationale as apiListFolders: the sidebar list is
// fetched once per surface, and concurrent mounts must not fan out
// duplicate GETs.
async function _apiListTeams(ownerId: string): Promise<TeamListItem[]> {
  const res = await fetch(`${API_BASE}/teams`, { headers: await apiHeaders(ownerId) });
  const { teams } = await expectOk<TeamsResponse>(res, 'list teams');
  return teams;
}
export const apiListTeams = dedupeInFlight(_apiListTeams, (ownerId) => ownerId);

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
