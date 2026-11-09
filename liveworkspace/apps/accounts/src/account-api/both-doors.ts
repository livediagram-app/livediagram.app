// The account API's routes both doors answer, the session's and the bearer's (account-api.ts).

import type { Env } from '../env.ts';
import { sendTeamInviteEmail } from '../email.ts';
import { signupAppOf } from '../lifecycle.ts';
import { readOwnProfile, checkProfilePatch, writeProfile } from '../profiles.ts';
import { readSettings, isSettingsApp, writeSettings } from '../settings.ts';
import {
  type Actor,
  createTeam,
  updateTeam,
  deleteTeam,
  makeInviteLink,
  clearInviteLink,
  inviteMember,
  setMemberRole,
  removeMember,
  answerInvitation,
  listMyTeams,
  listMyInvitations,
  getMembership,
  listMembers,
  currentInviteLink,
} from '../teams.ts';
import { listApiTokens, mintApiToken, cleanTokenName, revokeApiToken } from '../tokens.ts';
import { parseTimeZone } from '../send-window.ts';
import { reportServerEvent } from '../telemetry.ts';
import { endTokenWorkbench } from '../workbench/revoke.ts';
import { answer, error, json, readBody, type WaitUntil } from './http.ts';
import { type Reader, REMOVED_TYPES, tellAdmins } from './shared.ts';

// --- API tokens, on both doors: the session's on liveworkspace.app, the bearer's in an app's Settings
// (liveworkspace/docs/specs/003-accounts/accounts.md "Every account setting in every app") ---

// GET lists the live ones, POST `{ name?, readOnly? }` makes one (the secret once), DELETE `/:id` revokes one and ends
// its workbench pairings. Counted under the app the owner signed up through. Null for a route that isn't one of these.
export async function tokenRoutes(
  request: Request,
  env: Env,
  owner: string,
  parts: string[],
  waitUntil: WaitUntil,
): Promise<Response | null> {
  const [section, id, sub] = parts;
  if (section !== 'tokens') return null;
  const { method } = request;
  const db = env.AUTH_DB;
  const home = () => signupAppOf(db, owner);
  if (!id && method === 'GET') return json({ tokens: await listApiTokens(db, owner) });
  if (!id && method === 'POST') {
    const body = await readBody(request);
    const token = await mintApiToken(db, owner, {
      name: cleanTokenName(body.name, 'API token'),
      readOnly: body.readOnly === true,
    });
    if (!token) return error(409, 'token_limit_reached');
    reportServerEvent(env, 'Token', 'Created', 'Manual', home);
    return json(token, 201);
  }
  if (id && !sub && method === 'DELETE') {
    if (!(await revokeApiToken(db, owner, id))) return error(404, 'not_found');
    // Its workbench pairings go with it (workbench/revoke.ts).
    await endTokenWorkbench(env, owner, id, waitUntil);
    reportServerEvent(env, 'Token', 'Removed', null, home);
    return json({ id });
  }
  return null;
}

// --- The profile, on both doors: the session's on liveworkspace.app, the bearer's on an app's address and in the
// editors (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles") ---

// GET answers the person's own profile, PATCH `{ name?, color?, showPicture?, timeZone? }` sets any of them (null
// clears a name or colour, and puts the time zone back to Automatic). Both answer it with their own picture, its
// switch and their time zone (OwnProfile). `?timeZone=`, the browser's zone the Settings panel sends, is noted for
// the send window as a session sighting is (never over a zone picked by hand; an unknown one is ignored), so an
// account seen only in an editor's Settings is timed by its own zone too. Null for a method that isn't one of these.
export async function profileRoute(
  request: Request,
  db: Env['AUTH_DB'],
  owner: string,
): Promise<Response | null> {
  const noted = parseTimeZone(new URL(request.url).searchParams.get('timeZone'));
  if (request.method === 'GET') {
    return json({ profile: await readOwnProfile(db, owner, noted) });
  }
  if (request.method === 'PATCH') {
    const checked = checkProfilePatch(await readBody(request), { timeZone: true });
    if (!checked.ok) return error(400, checked.error);
    const result = await writeProfile(db, owner, checked.patch, Date.now(), noted);
    return result.ok ? json({ profile: result.value }) : answer(result);
  }
  return null;
}

// --- Running teams, on both doors: the session's on liveworkspace.app, the bearer's on an app's address ---

// Making, running and leaving teams and answering invitations (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in
// the Explorer"). The Explorer runs a team wherever it shows, so these answer the session on liveworkspace.app and
// the app's bearer alike. Null for a route that isn't one of these.
export async function teamRoutes(
  request: Request,
  env: Env,
  actor: Actor & { name: string },
  parts: string[],
): Promise<Response | null> {
  const { method } = request;
  const db = env.AUTH_DB;
  const [section, id, sub, subId, action] = parts;
  // Team events are counted under the app the actor signed up through, found when the batch goes (telemetry.ts).
  const home = () => signupAppOf(db, actor.id);

  if (section === 'teams') {
    if (!id) {
      if (method === 'GET') return myTeams(db, actor);
      if (method === 'POST') {
        const body = await readBody(request);
        const result = await createTeam(db, actor, body.name, Date.now(), body.organisation);
        if (result.ok) reportServerEvent(env, 'Team', 'Created', null, home);
        return answer(result, 201);
      }
    } else if (!sub) {
      if (method === 'PATCH') {
        const body = await readBody(request);
        const result = await updateTeam(db, actor, id, {
          name: body.name,
          organisation: body.organisation,
        });
        if (result.ok) reportServerEvent(env, 'Team', 'Changed', null, home);
        return answer(result);
      }
      if (method === 'DELETE') {
        const result = await deleteTeam(db, actor, id);
        if (result.ok) reportServerEvent(env, 'Team', 'Deleted', null, home);
        return answer(result);
      }
    } else if (sub === 'invite-link' && !subId) {
      // The team's join link: on (or a new one, ending the old), and off. Admins only.
      if (method === 'POST') {
        const result = await makeInviteLink(db, actor, id, env.BETTER_AUTH_SECRET, env.BASE_URL);
        if (result.ok) reportServerEvent(env, 'Team', 'Shared', 'Link', home);
        return answer(result);
      }
      if (method === 'DELETE') {
        const result = await clearInviteLink(db, actor, id);
        if (result.ok) reportServerEvent(env, 'Team', 'Removed', 'Link', home);
        return answer(result);
      }
    } else if (sub === 'members' && !action) {
      if (!subId) {
        if (method === 'GET') return teamMembers(db, env, actor, id);
        if (method === 'POST') {
          const body = await readBody(request);
          const result = await inviteMember(db, actor, id, body.email, body.role);
          if (result.ok) {
            reportServerEvent(env, 'Team', 'Added', 'Member', home);
            await sendTeamInviteEmail(env, {
              to: result.value.member.email,
              teamName: result.value.teamName,
              inviterName: actor.name,
              declineToken: result.value.declineToken,
              app: await signupAppOf(db, actor.id),
            }).catch((cause: unknown) => console.error('[teams] invite email failed', cause));
            return json(result.value.member, 201);
          }
          return answer(result);
        }
      } else {
        if (method === 'PATCH') {
          const result = await setMemberRole(db, actor, id, subId, (await readBody(request)).role);
          if (result.ok) reportServerEvent(env, 'Team', 'Changed', 'Role', home);
          return answer(result);
        }
        if (method === 'DELETE') {
          const result = await removeMember(db, actor, id, subId);
          if (result.ok) {
            reportServerEvent(env, 'Team', 'Removed', REMOVED_TYPES[result.value.removed], home);
          }
          return answer(result);
        }
      }
    }
  }

  if (
    section === 'invitations' &&
    id &&
    (sub === 'accept' || sub === 'decline') &&
    method === 'POST'
  ) {
    const result = await answerInvitation(db, actor, id, sub === 'accept');
    // Counted and told once, for an answer this request gave.
    if (result.ok && result.value.answered) {
      if (result.value.status === 'joined') reportServerEvent(env, 'Team', 'Joined', null, home);
      else reportServerEvent(env, 'Team', 'Declined', 'Invite', home);
      await tellAdmins(
        env,
        result.value.teamId,
        {
          teamName: result.value.teamName,
          responder: actor.email ?? actor.name,
          accepted: result.value.status === 'joined',
          app: result.value.inviterApp,
        },
        actor.id,
      );
    }
    if (result.ok) {
      const { answered: _answered, ...value } = result.value;
      return answer({ ok: true, value });
    }
    return answer(result);
  }
  return null;
}

// --- The reads both doors answer: the session's on liveworkspace.app, the bearer's on an app's address ---

async function myTeams(db: Env['AUTH_DB'], actor: Reader): Promise<Response> {
  const [teams, invitations] = await Promise.all([
    listMyTeams(db, actor.id),
    listMyInvitations(db, actor.email),
  ]);
  return json({ teams, invitations });
}

async function teamMembers(
  db: Env['AUTH_DB'],
  env: Env,
  actor: Reader,
  id: string,
): Promise<Response> {
  const me = await getMembership(db, id, actor.id);
  if (!me) return error(404, 'not_found');
  const [members, inviteLink] = await Promise.all([
    listMembers(db, id),
    me.role === 'admin' ? currentInviteLink(db, id, env.BETTER_AUTH_SECRET, env.BASE_URL) : null,
  ]);
  return json({
    team: {
      id,
      name: me.teamName,
      organisation: me.organisation,
      myRole: me.role,
      myMemberId: me.memberId,
    },
    members,
    // The join link admits anyone signed in, so only the admins see it.
    inviteLink,
  });
}

export async function sharedSettings(db: Env['AUTH_DB'], actor: Reader): Promise<Response> {
  const { all, updatedAt } = await readSettings(db, actor.id, null);
  return json({ all, updatedAt });
}

export async function appSettings(
  request: Request,
  db: Env['AUTH_DB'],
  actor: Reader,
  id: string,
): Promise<Response | null> {
  if (!isSettingsApp(id)) return error(404, 'not_found');
  if (request.method === 'GET') return json(await readSettings(db, actor.id, id));
  if (request.method === 'PATCH') {
    const result = await writeSettings(db, actor.id, id, { app: (await readBody(request)).app });
    return result.ok ? json(result.value) : answer(result);
  }
  return null;
}
