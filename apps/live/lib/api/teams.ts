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
  TeamListItem,
  TeamMember,
  TeamRole,
} from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import { API_BASE, apiDelete, apiHeaders, expectOk } from './core';

type TeamsResponse = { teams: TeamListItem[] };
type TeamResponse = { team: Team };
export type TeamDetailResponse = { team: Team; members: TeamMember[]; myRole: TeamRole };
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
