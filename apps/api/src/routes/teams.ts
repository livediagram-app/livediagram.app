// /api/teams (spec/32) — teams with Admin/Member roles. Clerk-only:
// membership is keyed by Clerk user id and invites by verified email,
// so the guest X-Owner-Id path is structurally insufficient and every
// request here requires a verified Bearer token (401 otherwise). The
// rest of the API keeps its hybrid guest path; this surface alone is
// signed-in (the canvas never is — spec/04).
//
// Two verified credentials reach the READ surface (spec/61 §3.4): a
// Clerk session JWT, or an `lvd_` API token (its owner is always a
// Clerk account) — so an external integration can list the caller's
// teams and read their shared libraries like the app does. Every
// MUTATION (create, invites, roles, join/accept/leave, invite links,
// deletion) additionally requires the interactive session: a leaked
// token must not be able to manage membership.

import type { TeamRole } from '@livediagram/api-schema';
import {
  acceptTeamMember,
  addTeamMember,
  connectInvitesByEmail,
  countJoinedMembers,
  countTeamAdmins,
  createTeam,
  deleteTeam,
  getMembership,
  getTeam,
  getTeamByInviteToken,
  getTeamInviteLink,
  getTeamMember,
  joinTeamByInviteToken,
  listDiagramsByTeam,
  listFoldersByTeam,
  listInvitesByUser,
  listTeamMembers,
  listTeamsByUser,
  removeTeamMember,
  setTeamInviteLink,
  teamHasEmail,
  TEAM_INVITE_LINK_TTL_MS,
  updateTeam,
  updateTeamMemberRole,
} from '../db';
import {
  badRequest,
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  signInRequired,
} from '../responses';
import { emailEnabled, sendEmail } from '../email/client';
import { notifyInviteResponse } from '../email/notifications';
import { teamInviteEmail } from '../email/templates';
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
  const { request, env, segments, clerkUserId, clerkEmail, verifiedUserId } = ctx;
  if (segments[1] !== 'teams') return notFound();
  // Identity for everything below: the verified Clerk account id, from a
  // session JWT or an API token (see the header comment). Mutations are
  // additionally gated on `clerkUserId` after the shared sign-in gate.
  const userId = verifiedUserId;

  // /api/teams/invite-link/<token> — RESOLVE a shareable join link
  // (spec/32). Guest-accessible (sits ABOVE the sign-in gate): a token
  // holder must see WHAT team they're joining before they sign in. The
  // token is the credential, so returning the team name to anyone who
  // has it is fine. The join POST needs a verified user — it's below
  // the gate.
  if (request.method === 'GET' && segments.length === 4 && segments[2] === 'invite-link') {
    const team = await getTeamByInviteToken(env, segments[3]!);
    if (!team) return notFound();
    const memberCount = await countJoinedMembers(env, team.id);
    const alreadyMember = userId ? (await getMembership(env, team.id, userId)) !== null : false;
    return json({ team, memberCount, alreadyMember });
  }

  if (!userId) return signInRequired();
  // Read vs manage (spec/61 §3.4): an API token passes the gate above for
  // GETs, but every mutation needs the interactive Clerk session.
  if (request.method !== 'GET' && !clerkUserId) return signInRequired();

  // /api/teams/invite-link/<token>/join — JOIN via the link (spec/32).
  // Signed-in only (above). Adds the caller as a joined member; the db
  // helper de-dupes against an existing membership / pending invite.
  if (segments.length === 5 && segments[2] === 'invite-link' && segments[4] === 'join') {
    if (request.method !== 'POST') return notFound();
    const result = await joinTeamByInviteToken(env, segments[3]!, userId, clerkEmail);
    if (!result) return notFound();
    return json(result);
  }

  // /api/teams — list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      // Lazy invite claim before listing, so a pending invite for the
      // caller's verified address becomes a membership in the same
      // round-trip that would render it.
      if (clerkEmail) await connectInvitesByEmail(env, userId, clerkEmail);
      const teams = await listTeamsByUser(env, userId);
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
        { userId, email: clerkEmail },
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
      if (clerkEmail) await connectInvitesByEmail(env, userId, clerkEmail);
      const invites = await listInvitesByUser(env, userId);
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
  const me = await getMembership(env, teamId, userId);
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
      if (me.status !== 'joined') return forbidden();
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
      // The invite link is an admin-only management surface (spec/32),
      // so only admins get its token in the detail payload.
      const inviteLink = isAdmin ? await getTeamInviteLink(env, teamId) : null;
      return json({ team, members, myRole: me.role, inviteLink });
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

  // /api/teams/<id>/invite-link — admin turns the shareable join link
  // on (POST: generate / rotate, fixed 1-week expiry) or off (DELETE).
  // Admin-only management surface (spec/32).
  if (segments.length === 4 && segments[3] === 'invite-link') {
    if (!isAdmin) return adminRequired();
    if (request.method === 'POST') {
      const token = crypto.randomUUID();
      const expiresAt = Date.now() + TEAM_INVITE_LINK_TTL_MS;
      await setTeamInviteLink(env, teamId, token, expiresAt);
      return json({ inviteLink: { token, expiresAt } }, { status: 201 });
    }
    if (request.method === 'DELETE') {
      await setTeamInviteLink(env, teamId, null, null);
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
      // spec/64: tell the invitee they've been invited, with a link to their
      // invites page. Best-effort, in the background; no-op when email is off.
      if (emailEnabled(env)) {
        ctx.waitUntil?.(sendEmail(env, { to: email, ...teamInviteEmail(env, team.name) }));
      }
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
    if (member.userId === null || member.userId !== userId) {
      return forbidden('not_your_invite');
    }
    if (member.status === 'invited') {
      await acceptTeamMember(env, member.id);
      // spec/65: tell the team's admins someone said yes. Best-effort,
      // off the response path; no-op when email is off / admins opted out.
      const responder = member.email ?? clerkEmail;
      if (responder) {
        ctx.waitUntil?.(notifyInviteResponse(env, team, responder, true, userId).catch(() => {}));
      }
    }
    const updated = await getTeamMember(env, member.id);
    return json({ member: updated });
  }

  // /api/teams/<id>/members/<memberId> — role change / remove
  // (removing your own row doubles as both "leave" and "decline").
  if (segments.length === 5 && segments[3] === 'members') {
    const member = await getTeamMember(env, segments[4]!);
    if (!member || member.teamId !== teamId) return notFound();
    const isSelf = member.userId !== null && member.userId === userId;

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
      // spec/65: a self-removal of a still-INVITED row is a DECLINE — tell
      // the team's admins. An admin revoking a pending invite, or a joined
      // member leaving, is not an invite response and notifies no one.
      if (member.status === 'invited' && isSelf) {
        const responder = member.email ?? clerkEmail;
        if (responder) {
          ctx.waitUntil?.(
            notifyInviteResponse(env, team, responder, false, userId).catch(() => {}),
          );
        }
      }
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
  return forbidden('admin_required');
}
