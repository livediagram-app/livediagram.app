// /api/teams (spec/32) — teams with Admin/Member roles. Clerk-only:
// membership is keyed by Clerk user id and invites by verified email,
// so the guest X-Owner-Id path is structurally insufficient and every
// request here requires a verified Bearer token (401 otherwise). The
// rest of the API keeps its hybrid guest path; this surface alone is
// signed-in (the canvas never is — spec/04).

import type { TeamRole } from '@livediagram/api-schema';
import {
  acceptTeamMember,
  addTeamMember,
  connectInvitesByEmail,
  countTeamAdmins,
  createTeam,
  deleteTeam,
  getMembership,
  getTeam,
  getTeamMember,
  listDiagramsByTeam,
  listFoldersByTeam,
  listInvitesByUser,
  listTeamMembers,
  listTeamsByUser,
  removeTeamMember,
  teamHasEmail,
  updateTeam,
  updateTeamMemberRole,
} from '../db';
import { badRequest, conflict, json, noContent, notFound, signInRequired } from '../responses';
import type { RouteContext } from './context';

// Light shape check, not RFC 5322: something@something.tld. The real
// gate is that the address only ever matters if its owner can sign in
// to Clerk with it; this just catches paste accidents.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEAM_NAME_MAX = 80;
const ORGANISATION_MAX = 120;

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function handleTeams(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, clerkUserId, clerkEmail } = ctx;
  if (segments[1] !== 'teams') return notFound();
  if (!clerkUserId) return signInRequired();

  // /api/teams — list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      // Lazy invite claim before listing, so a pending invite for the
      // caller's verified address becomes a membership in the same
      // round-trip that would render it.
      if (clerkEmail) await connectInvitesByEmail(env, clerkUserId, clerkEmail);
      const teams = await listTeamsByUser(env, clerkUserId);
      return json({ teams });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as {
        id?: string;
        name?: string;
        organisation?: string | null;
      } | null;
      const name = body?.name?.trim();
      if (!body?.id || !name) return badRequest('missing id/name');
      if (name.length > TEAM_NAME_MAX) return badRequest('name too long');
      const organisation = body.organisation?.trim() || null;
      if (organisation && organisation.length > ORGANISATION_MAX) {
        return badRequest('organisation too long');
      }
      const team = await createTeam(
        env,
        { id: body.id, name, organisation },
        { userId: clerkUserId, email: clerkEmail },
      );
      return json({ team }, { status: 201 });
    }
    return notFound();
  }

  // /api/teams/invites — the caller's pending invites (spec/32).
  // Sits above the team-scoped resolution because 'invites' occupies
  // the id slot (team ids are UUIDs, so no collision). Runs the same
  // lazy claim as the list so the two calls are order-independent.
  if (segments.length === 3 && segments[2] === 'invites') {
    if (request.method === 'GET') {
      if (clerkEmail) await connectInvitesByEmail(env, clerkUserId, clerkEmail);
      const invites = await listInvitesByUser(env, clerkUserId);
      return json({ invites });
    }
    return notFound();
  }

  // Everything below is team-scoped: resolve the team and the
  // caller's membership once. Non-members get 404 (not 403) so a
  // team id can't be probed for existence. An 'invited' membership
  // row passes this gate — the invitee may read the team to decide,
  // accept, or decline (delete their row) — but every admin verb
  // below additionally requires a JOINED admin row.
  const teamId = segments[2]!;
  const team = await getTeam(env, teamId);
  if (!team) return notFound();
  const me = await getMembership(env, teamId, clerkUserId);
  if (!me) return notFound();
  // Admin verbs need an accepted admin row: a pending invite that was
  // pre-promoted to admin manages nothing until they join.
  const isAdmin = me.role === 'admin' && me.status === 'joined';

  // /api/teams/<id>/library — the team's shared folder tree +
  // diagrams (spec/35). Any membership row passes the gate above,
  // but the library is for JOINED members only — an invitee deciding
  // on an invite sees the team's shape, not its content.
  if (segments.length === 4 && segments[3] === 'library') {
    if (request.method === 'GET') {
      if (me.status !== 'joined') return json({ error: 'forbidden' }, { status: 403 });
      const [folders, diagrams] = await Promise.all([
        listFoldersByTeam(env, teamId),
        listDiagramsByTeam(env, teamId),
      ]);
      return json({ folders, diagrams });
    }
    return notFound();
  }

  // /api/teams/<id> — read / update / delete
  if (segments.length === 3) {
    if (request.method === 'GET') {
      const members = await listTeamMembers(env, teamId);
      return json({ team, members, myRole: me.role });
    }
    if (request.method === 'PUT') {
      if (!isAdmin) return adminRequired();
      const body = (await request.json().catch(() => null)) as {
        name?: string;
        organisation?: string | null;
      } | null;
      if (!body) return badRequest('missing body');
      const patch: { name?: string; organisation?: string | null } = {};
      if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name) return badRequest('empty name');
        if (name.length > TEAM_NAME_MAX) return badRequest('name too long');
        patch.name = name;
      }
      if (body.organisation !== undefined) {
        const organisation = body.organisation?.trim() || null;
        if (organisation && organisation.length > ORGANISATION_MAX) {
          return badRequest('organisation too long');
        }
        patch.organisation = organisation;
      }
      await updateTeam(env, teamId, patch);
      const updated = await getTeam(env, teamId);
      return json({ team: updated });
    }
    if (request.method === 'DELETE') {
      if (!isAdmin) return adminRequired();
      await deleteTeam(env, teamId);
      return noContent();
    }
    return notFound();
  }

  // /api/teams/<id>/members — invite
  if (segments.length === 4 && segments[3] === 'members') {
    if (request.method === 'POST') {
      if (!isAdmin) return adminRequired();
      const body = (await request.json().catch(() => null)) as { email?: string } | null;
      const email = body?.email ? normaliseEmail(body.email) : '';
      if (!email || !EMAIL_PATTERN.test(email)) return badRequest('invalid email');
      if (await teamHasEmail(env, teamId, email)) return conflict('already_member');
      const member = await addTeamMember(env, { teamId, email });
      return json({ member }, { status: 201 });
    }
    return notFound();
  }

  // /api/teams/<id>/members/<memberId>/accept — the invitee's yes
  // (spec/32): own row only, and only while it's still 'invited'.
  if (segments.length === 6 && segments[3] === 'members' && segments[5] === 'accept') {
    if (request.method !== 'POST') return notFound();
    const member = await getTeamMember(env, segments[4]!);
    if (!member || member.teamId !== teamId) return notFound();
    if (member.userId === null || member.userId !== clerkUserId) {
      return json({ error: 'not_your_invite' }, { status: 403 });
    }
    if (member.status === 'invited') await acceptTeamMember(env, member.id);
    const updated = await getTeamMember(env, member.id);
    return json({ member: updated });
  }

  // /api/teams/<id>/members/<memberId> — role change / remove
  // (removing your own row doubles as both "leave" and "decline").
  if (segments.length === 5 && segments[3] === 'members') {
    const member = await getTeamMember(env, segments[4]!);
    if (!member || member.teamId !== teamId) return notFound();
    const isSelf = member.userId !== null && member.userId === clerkUserId;

    if (request.method === 'PUT') {
      if (!isAdmin) return adminRequired();
      const body = (await request.json().catch(() => null)) as { role?: string } | null;
      const role = body?.role;
      if (role !== 'admin' && role !== 'member') return badRequest('invalid role');
      // Last-admin guard (spec/32): demoting the only JOINED admin
      // would leave the team unmanageable. Invited rows are exempt —
      // they don't count as managing admins yet either way.
      if (member.role === 'admin' && member.status === 'joined' && role === 'member') {
        if ((await countTeamAdmins(env, teamId)) <= 1) return conflict('last_admin');
      }
      if (role !== member.role) await updateTeamMemberRole(env, member.id, role as TeamRole);
      const updated = await getTeamMember(env, member.id);
      return json({ member: updated });
    }
    if (request.method === 'DELETE') {
      // Admins remove anyone; a non-admin may only remove their own
      // row (leave / decline). Same last-admin guard either way,
      // skipped for invited rows (declining a pre-promoted invite
      // must always work — it was never a managing admin).
      if (!isAdmin && !isSelf) return adminRequired();
      if (
        member.role === 'admin' &&
        member.status === 'joined' &&
        (await countTeamAdmins(env, teamId)) <= 1
      ) {
        return conflict('last_admin');
      }
      await removeTeamMember(env, member.id);
      return noContent();
    }
    return notFound();
  }

  return notFound();
}

// Members who try admin-only verbs get a plain 403. Named wrapper so
// the call sites read as intent (and a future audit of "who can hit
// this" greps to one symbol).
function adminRequired(): Response {
  return json({ error: 'admin_required' }, { status: 403 });
}
