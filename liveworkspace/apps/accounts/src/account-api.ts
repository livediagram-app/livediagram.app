// The account API under /api/account (liveworkspace/docs/accounts.md "Teams" and "API tokens"):
//   - for the signed-in person on liveworkspace.app, by their session cookie: their teams, members and
//     invitations, their API tokens, their settings shared by every app, and their profile;
//   - for the apps' servers, by their OAuth client credentials (/api/account/internal/*): checking an
//     API token, making one for a connecting AI tool, a token revoking itself, which tokens still
//     work, the teams change feed, a team made in an app, reading and writing someone's settings, and
//     reading profiles and setting one's own, an app's sign-ups and milestones, accounts' emails, and
//     for notification emails, many people's notify switches at once and a team's people; and for livediagram's
//     api, a returning guest of the old livediagram.app claimed (legacy-guests.ts).
//   - workbenches, for every app (/api/account/workbench/*, workbench/routes.ts), and the apps' servers' checks of
//     their sessions (workbench/internal.ts).
import { AUTH_BASE_PATH } from './auth-options.ts';
import { sameSiteOrigin } from '@liveworkspace/sites/www';
import { introspectWithLegacy } from './legacy-issuer.ts';
import { bearerOf, bearerPerson } from './bearer.ts';
import { noteGuestSeen } from './guest-sweep.ts';
import { guestOfRequest } from './guests.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { sendInviteResponseEmails, sendTeamInviteEmail } from './email.ts';
import {
  claimMilestone,
  isMilestone,
  MAX_EMAIL_IDS,
  recordSighting,
  verifiedEmails,
} from './account-apps.ts';
import { clientApp } from './clients.ts';
import { GUEST_ID, USER_ID } from './ids.ts';
import { sameSecret } from './secrets.ts';
import { pendingInvitations } from './internal-invitations.ts';
import { claimLegacyGuest, legacyClaimConfig } from './legacy-guests.ts';
import { recordActivity, signupAppOf } from './lifecycle.ts';
import { rangeOf } from './rate-limit.ts';
import {
  isNotifyKey,
  MAX_NOTIFY_KEYS,
  MAX_NOTIFY_OWNERS,
  readNotifySettings,
  teamPeople,
} from './notify.ts';
import {
  checkProfilePatch,
  isProfileOwner,
  MAX_PROFILE_IDS,
  readOwnProfile,
  readProfiles,
  writeProfile,
} from './profiles.ts';
import {
  isSettingsApp,
  isSettingsOwner,
  readSettings,
  writeSettings,
  type SettingsApp,
} from './settings.ts';
import {
  answerInvitation,
  clearInviteLink,
  createTeam,
  currentInviteLink,
  declineByToken,
  deleteTeam,
  getMembership,
  inviteMember,
  inviteResponseRecipients,
  joinByInviteLink,
  listMembers,
  listMyInvitations,
  listMyTeams,
  makeInviteLink,
  previewInviteLink,
  readDeclineToken,
  removeMember,
  setMemberRole,
  teamChanges,
  teamsClaim,
  updateTeam,
  type Actor,
  type Result,
} from './teams.ts';
import {
  cleanTokenName,
  listApiTokens,
  liveApiTokenIds,
  MAX_LIVE_TOKEN_IDS,
  mintApiToken,
  revokeApiToken,
  revokeApiTokenBySecret,
  verifyApiToken,
} from './tokens.ts';
import { reportServerEvent } from './telemetry.ts';
import { handleWorkbenchInternal } from './workbench/internal.ts';
import { endTokenWorkbench, tokenBySecret } from './workbench/revoke.ts';
import { handleWorkbench } from './workbench/routes.ts';

export const ACCOUNT_API_PATH = '/api/account';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const error = (status: number, code: string) => json({ error: code }, status);

function answer<T>(result: Result<T>, status = 200): Response {
  return result.ok ? json(result.value, status) : error(result.status, result.error);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

type WaitUntil = (promise: Promise<unknown>) => void;

export async function handleAccountApi(
  request: Request,
  env: Env,
  auth: Auth,
  waitUntil: WaitUntil = (promise) => void promise,
): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.slice(ACCOUNT_API_PATH.length).split('/').filter(Boolean);
  if (parts[0] === 'internal')
    return handleInternal(request, env, auth, parts.slice(1), url, waitUntil);
  // Workbenches, for every app (workbench/routes.ts): an API token, a ticket, a workbench session or the signed-in
  // owner, each route deciding which.
  if (parts[0] === 'workbench') {
    return handleWorkbench({ request, env, auth, waitUntil, now: Date.now() }, parts.slice(1));
  }
  if (parts[0] === 'index' && parts[1] === 'teams' && parts.length === 2) {
    return handleIndexTeams(request, env);
  }
  const bearer = bearerOf(request);
  if (bearer) return handleBearer(request, env, auth, parts, bearer);
  return handleSignedIn(request, env, auth, parts, waitUntil);
}

// --- The index, with the key it shares with accounts (INDEX_MERGE_KEY) ---

// POST /api/account/index/teams {userId}: the teams an account is in now, for the index when a request names a
// team its access token does not claim yet (a team made or joined since the token was minted).
async function handleIndexTeams(request: Request, env: Env): Promise<Response> {
  const key = env.INDEX_MERGE_KEY?.trim();
  const sent = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (request.method !== 'POST') return error(404, 'not_found');
  if (!key || !sent || !(await sameSecret(sent, key))) return error(401, 'unauthorized');
  const { userId } = await readBody(request);
  if (typeof userId !== 'string' || !USER_ID.test(userId)) return error(400, 'invalid_user');
  return json({ teams: await teamsClaim(env.AUTH_DB, userId) });
}

// --- The signed-in person, on liveworkspace.app ---

async function sessionActor(
  request: Request,
  auth: Auth,
): Promise<(Actor & { name: string }) | null> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.emailVerified ? user.email.toLowerCase() : null,
  };
}

// The session cookie is SameSite=Lax, which already keeps it off another site's requests; a write
// must also come from the site itself, on either of its hosts while the move to www. lasts.
function sameOrigin(request: Request, env: Env): boolean {
  return sameSiteOrigin(request.headers.get('origin') ?? '', env.BASE_URL);
}

// The doors that need no session, each limited per network (TEAM_LINK_LIMITER; absent, allowed): a
// join link's preview, so someone signed out sees what they'd join before signing in; and an
// invitation email's Decline link, which reads and declines that one invitation and nothing else.
async function handleOpen(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
): Promise<Response | null> {
  const { method } = request;
  const [section, id, sub, token] = parts;
  const db = env.AUTH_DB;

  // Other people's names for a guest on liveworkspace.app, whose Explorer names owners and who did what as it does
  // for an account: the browser's own guest (its signed cookie) may read them, limited per network. Anyone with
  // neither a session nor a guest is signed out. A session's read goes on to the signed-in door.
  if (section === 'people' && !id && method === 'GET') {
    if (await sessionActor(request, auth)) return null;
    if (!(await guestOfRequest(request, env.BETTER_AUTH_SECRET))) return error(401, 'signed_out');
    if (await overLinkLimit(request, env, 'people')) return error(429, 'rate_limited');
    return peopleNames(request, db, { pictures: false });
  }

  if (section === 'join' && id && !sub && method === 'GET') {
    if (await overLinkLimit(request, env)) return error(429, 'rate_limited');
    const actor = await sessionActor(request, auth);
    const preview = await previewInviteLink(db, id, actor?.id ?? null);
    return preview
      ? json({ ...preview, signedIn: Boolean(actor) })
      : error(404, 'invite_not_found');
  }

  if (section === 'invitations' && id === 'decline' && sub && !token) {
    if (method !== 'GET' && method !== 'POST') return null;
    if (await overLinkLimit(request, env)) return error(429, 'rate_limited');
    if (method === 'GET') {
      const found = await readDeclineToken(db, sub);
      return found ? json(found) : error(404, 'invite_not_found');
    }
    const result = await declineByToken(db, sub);
    if (result.ok && result.value.declined && result.value.inviterApp) {
      // No account need be behind an email's Decline: counted under the inviter's app.
      reportServerEvent(env, 'Team', 'Declined', 'Email', result.value.inviterApp);
    }
    if (result.ok && result.value.declined) {
      await tellAdmins(env, result.value.teamId, {
        teamName: result.value.teamName,
        responder: result.value.email,
        accepted: false,
        app: result.value.inviterApp,
      });
    }
    return result.ok
      ? json({ teamName: result.value.teamName, status: result.value.status })
      : error(result.status, result.error);
  }

  return null;
}

// Team·Removed's type for who went (removeMember), as the apps have always named it.
const REMOVED_TYPES = { self: 'Self', invite: 'Invite', member: 'Member' } as const;

// Per network (an IPv4 /24 or an IPv6 /48), so one machine can't dodge the limit by changing address.
async function overLinkLimit(request: Request, env: Env, door = 'team-link'): Promise<boolean> {
  if (!env.TEAM_LINK_LIMITER) return false;
  return !(await env.TEAM_LINK_LIMITER.limit({ key: `${door}:${rangeOf(request)}` })).success;
}

// Display names by id: what collaborators see on a cursor or a comment anyway, up to MAX_PROFILE_IDS a read; ids
// not found are left out. With `pictures` (an account asking, never a guest: liveworkspace/docs/accounts.md "Profile
// pictures"), each person's published Google picture too, read in the same query as the name.
async function peopleNames(
  request: Request,
  db: Env['AUTH_DB'],
  { pictures }: { pictures: boolean },
): Promise<Response> {
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter((v) => USER_ID.test(v) || GUEST_ID.test(v));
  if (ids.length > MAX_PROFILE_IDS) return error(400, 'too_many_ids');
  const profiles = await readProfiles(db, ids);
  return json({
    people: profiles.map((p) =>
      pictures ? { id: p.id, name: p.name, picture: p.picture } : { id: p.id, name: p.name },
    ),
  });
}

// Someone answered an invitation: the team's admins hear of it, unless they turned it off. A failed
// email never fails the answer.
async function tellAdmins(
  env: Env,
  teamId: string,
  response: { teamName: string; responder: string; accepted: boolean; app: SettingsApp | null },
): Promise<void> {
  try {
    const recipients = await inviteResponseRecipients(env.AUTH_DB, teamId);
    if (recipients.length) {
      await sendInviteResponseEmails(env, recipients, { ...response, teamId });
    }
  } catch (cause) {
    console.error('[teams] invite response email failed', cause);
  }
}

async function handleSignedIn(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
  waitUntil: WaitUntil,
): Promise<Response> {
  const { method } = request;
  if (method !== 'GET' && !sameOrigin(request, env)) return error(403, 'cross_origin');
  const open = await handleOpen(request, env, auth, parts);
  if (open) return open;
  const actor = await sessionActor(request, auth);
  if (!actor) return error(401, 'signed_out');
  const db = env.AUTH_DB;
  const [section, id, sub] = parts;
  // Join and token events are counted under the app the actor signed up through, found when the batch
  // goes (telemetry.ts).
  const home = () => signupAppOf(db, actor.id);

  const teams = await teamRoutes(request, env, actor, parts);
  if (teams) return teams;

  // Joining through a team's join link. Its preview (GET) is open: handleOpen.
  if (section === 'join' && id && !sub && method === 'POST') {
    if (await overLinkLimit(request, env)) return error(429, 'rate_limited');
    const result = await joinByInviteLink(db, actor, id);
    if (result.ok && !result.value.alreadyMember)
      reportServerEvent(env, 'Team', 'Joined', null, home);
    return answer(result);
  }

  if (section === 'tokens') {
    if (!id && method === 'GET') return json({ tokens: await listApiTokens(db, actor.id) });
    if (!id && method === 'POST') {
      const body = await readBody(request);
      const token = await mintApiToken(db, actor.id, {
        name: cleanTokenName(body.name, 'API token'),
        readOnly: body.readOnly === true,
      });
      if (!token) return error(409, 'token_limit_reached');
      reportServerEvent(env, 'Token', 'Created', 'Manual', home);
      return json(token, 201);
    }
    if (id && !sub && method === 'DELETE') {
      if (!(await revokeApiToken(db, actor.id, id))) return error(404, 'not_found');
      // Its workbench pairings go with it (workbench/revoke.ts).
      await endTokenWorkbench(env, actor.id, id, waitUntil);
      reportServerEvent(env, 'Token', 'Removed', null, home);
      return json({ id });
    }
  }

  // Other people's display names and pictures, by id (the Explorer's Owner column, its Inbox and Timeline).
  if (section === 'people' && !id && method === 'GET') {
    return peopleNames(request, db, { pictures: true });
  }

  // Their display name and colour, the ones collaborators see in every app.
  if (section === 'profile' && !id) {
    const answered = await profileRoute(request, db, actor.id);
    if (answered) return answered;
  }

  // The settings every app shows; each app's own are its server's to read and write.
  if (section === 'settings' && !id) {
    if (method === 'GET') return sharedSettings(db, actor);
    if (method === 'PATCH') return patchSharedSettings(request, db, actor);
  }

  // One app's own settings, for its dialog on the settings page: GET answers both scopes (the app's
  // rows can depend on a shared switch), PATCH `{ app }` changes only the app's. Always the signed-in
  // person's own rows.
  if (section === 'settings' && id && !sub) {
    const answered = await appSettings(request, db, actor, id);
    if (answered) return answered;
  }

  return error(404, 'not_found');
}

// --- The profile, on both doors: the session's on liveworkspace.app, the bearer's on an app's address and in the
// editors (liveworkspace/docs/accounts.md "Profiles") ---

// GET answers the person's own profile, PATCH `{ name?, color?, showPicture? }` sets any of them (null clears a name
// or colour). Both answer it with their own picture and its switch (OwnProfile). Null for a method that isn't one of
// these.
async function profileRoute(
  request: Request,
  db: Env['AUTH_DB'],
  owner: string,
): Promise<Response | null> {
  if (request.method === 'GET') {
    return json({ profile: await readOwnProfile(db, owner) });
  }
  if (request.method === 'PATCH') {
    const checked = checkProfilePatch(await readBody(request));
    if (!checked.ok) return error(400, checked.error);
    const result = await writeProfile(db, owner, checked.patch);
    return result.ok ? json({ profile: result.value }) : answer(result);
  }
  return null;
}

// --- Running teams, on both doors: the session's on liveworkspace.app, the bearer's on an app's address ---

// Making, running and leaving teams and answering invitations (liveworkspace/docs/one-explorer.md "Teams are run in
// the Explorer"). The Explorer runs a team wherever it shows, so these answer the session on liveworkspace.app and
// the app's bearer alike. Null for a route that isn't one of these.
async function teamRoutes(
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
    if (result.ok && result.value.status === 'joined') {
      reportServerEvent(env, 'Team', 'Joined', null, home);
    } else if (result.ok) {
      reportServerEvent(env, 'Team', 'Declined', 'Invite', home);
    }
    if (result.ok) {
      await tellAdmins(env, result.value.teamId, {
        teamName: result.value.teamName,
        responder: actor.email ?? actor.name,
        accepted: result.value.status === 'joined',
        app: result.value.inviterApp,
      });
    }
    return answer(result);
  }
  return null;
}

// --- The reads both doors answer: the session's on liveworkspace.app, the bearer's on an app's address ---

type Reader = Pick<Actor, 'id' | 'email'>;

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

async function sharedSettings(db: Env['AUTH_DB'], actor: Reader): Promise<Response> {
  const { all, updatedAt } = await readSettings(db, actor.id, null);
  return json({ all, updatedAt });
}

async function appSettings(
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

// --- The Explorer on an app's own address, by the app's bearer (bearer.ts) ---

// What that page and the editors' Explorer panels and Settings need: names for a guest or an account, and for an
// account its settings (the shared scope and each app's, read and patched), its profile (profileRoute: the app's API
// already sets the same name and colour with this token, PUT /api/participants/:id, so this grants nothing new) and
// its teams, run in place (teamRoutes). A bearer is no ambient credential, so a write needs no same-origin check: a
// page can only send one it holds. Joining by link and API tokens stay the session's.
async function handleBearer(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
  token: string,
): Promise<Response> {
  const person = await bearerPerson(token, env, auth);
  if (!person) return error(401, 'signed_out');
  const { method } = request;
  const [section, id, sub] = parts;
  const db = env.AUTH_DB;
  if (section === 'people' && !id && method === 'GET') {
    if (person.kind === 'guest' && (await overLinkLimit(request, env, 'people'))) {
      return error(429, 'rate_limited');
    }
    return peopleNames(request, db, { pictures: person.kind === 'account' });
  }
  if (person.kind !== 'account') return error(401, 'signed_out');
  const actor: Reader = {
    id: person.userId,
    email: person.emailVerified && person.email ? person.email.toLowerCase() : null,
  };
  if (section === 'teams' || section === 'invitations') {
    const teams = await teamRoutes(
      request,
      env,
      { ...actor, name: await accountName(db, actor.id) },
      parts,
    );
    if (teams) return teams;
  }
  // The Settings panel there shows the account's own switches (the `all` scope) beside each app's.
  if (section === 'settings' && !id && method === 'GET') return sharedSettings(db, actor);
  if (section === 'settings' && !id && method === 'PATCH') {
    return patchSharedSettings(request, db, actor);
  }
  if (section === 'settings' && id && !sub) {
    const answered = await appSettings(request, db, actor, id);
    if (answered) return answered;
  }
  // The Settings panel's Profile there sets the name and colour in place.
  if (section === 'profile' && !id) {
    const answered = await profileRoute(request, db, actor.id);
    if (answered) return answered;
  }
  return error(404, 'not_found');
}

// A patch of the settings every app shares (`PATCH { all }`), on either door: it answers the scope as it now is.
async function patchSharedSettings(
  request: Request,
  db: Env['AUTH_DB'],
  actor: Reader,
): Promise<Response> {
  const result = await writeSettings(db, actor.id, null, { all: (await readBody(request)).all });
  return result.ok
    ? json({ all: result.value.all, updatedAt: result.value.updatedAt })
    : answer(result);
}

// The account's display name, for the Timeline's "by …" and the invitation email (a token carries none).
async function accountName(db: Env['AUTH_DB'], userId: string): Promise<string> {
  const row = await db
    .prepare('SELECT name FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ name: string | null }>();
  return row?.name ?? '';
}

// --- The apps' servers ---

// Client credentials already checked in this isolate, by a hash of the header, with the app the
// client is, so an app's burst of token checks costs one credential check, not one each.
const CLIENT_CHECK_TTL_MS = 5 * 60_000;
type CheckedClient = { clientId: string; app: SettingsApp | null };
const checkedClients = new Map<string, CheckedClient & { until: number }>();

function basicClientId(header: string | null): string | null {
  const encoded = header?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!encoded) return null;
  try {
    const decoded = atob(encoded);
    const colon = decoded.indexOf(':');
    return colon > 0 ? decodeURIComponent(decoded.slice(0, colon)) : null;
  } catch {
    return null;
  }
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

// An app's client id, and the app it is, when the request carries its client credentials. The
// OAuth provider checks them, through token introspection: it answers 401 for a wrong secret and 200
// otherwise.
async function verifiedClient(
  request: Request,
  auth: Auth,
  db: D1Database,
  now = Date.now(),
): Promise<CheckedClient | null> {
  const authorization = request.headers.get('authorization');
  const clientId = basicClientId(authorization);
  if (!authorization || !clientId) return null;
  const key = await digest(authorization);
  const known = checkedClients.get(key);
  if (known && known.until > now) return { clientId: known.clientId, app: known.app };
  const checked = await auth.handler(
    new Request(new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url), {
      method: 'POST',
      headers: {
        authorization,
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: 'client-check',
        token_type_hint: 'access_token',
      }).toString(),
    }),
  );
  if (!checked.ok) return null;
  const app = await clientApp(db, clientId);
  if (checkedClients.size > 100) checkedClients.clear();
  checkedClients.set(key, { clientId, app, until: now + CLIENT_CHECK_TTL_MS });
  return { clientId, app };
}

// The account an access token belongs to, when it was minted for this very client and is still
// live (the provider's introspection checks both): how an app vouches for the person it acts for.
async function vouchedPerson(
  request: Request,
  env: Env,
  auth: Auth,
  clientId: string,
  accessToken: unknown,
): Promise<string | Response> {
  if (typeof accessToken !== 'string') return error(400, 'access_token_required');
  // A token minted under the bare issuer before the move to www. is checked again here (legacy-issuer.ts).
  const { status, result } = await introspectWithLegacy(
    () =>
      auth.handler(
        new Request(new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url), {
          method: 'POST',
          headers: {
            authorization: request.headers.get('authorization') ?? '',
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: accessToken,
            token_type_hint: 'access_token',
          }).toString(),
        }),
      ),
    accessToken,
    clientId,
    env,
    auth,
  );
  if (
    status !== 200 ||
    result.active !== true ||
    typeof result.sub !== 'string' ||
    result.client_id !== clientId
  ) {
    return error(401, 'invalid_token');
  }
  return result.sub;
}

async function handleInternal(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
  url: URL,
  waitUntil: WaitUntil,
): Promise<Response> {
  const db = env.AUTH_DB;
  const client = await verifiedClient(request, auth, db);
  if (!client) return error(401, 'invalid_client');
  const { clientId } = client;
  const route = `${request.method} ${parts.join('/')}`;

  // An app's workbench sessions, rooms and senders' allowances (workbench/internal.ts).
  const workbench = await handleWorkbenchInternal(request, env, client.app, route);
  if (workbench) return workbench;

  if (route === 'POST tokens/verify') {
    const { token } = await readBody(request);
    const verified = typeof token === 'string' ? await verifyApiToken(db, token) : null;
    if (!verified) return error(404, 'invalid_token');
    return json({ ...verified, teams: await teamsClaim(db, verified.userId) });
  }

  // A token for an AI tool someone is connecting in an app: the app vouches for the person with the
  // access token it holds for them, so it can only make tokens for someone signed in to it.
  if (route === 'POST tokens') {
    const body = await readBody(request);
    const person = await vouchedPerson(request, env, auth, clientId, body.accessToken);
    if (person instanceof Response) return person;
    const token = await mintApiToken(db, person, {
      name: cleanTokenName(body.name, 'MCP client'),
      readOnly: body.readOnly === true,
    });
    return token ? json(token, 201) : error(409, 'token_limit_reached');
  }

  // A team made in an app (livediagram's Move dialog has a New team tile), for the person signed in
  // to it, vouched for as above. The same team, and the same limits, as one made on the site: the
  // person becomes its admin.
  if (route === 'POST teams') {
    const body = await readBody(request);
    const person = await vouchedPerson(request, env, auth, clientId, body.accessToken);
    if (person instanceof Response) return person;
    const user = await db
      .prepare('SELECT email, emailVerified FROM "user" WHERE id = ?')
      .bind(person)
      .first<{ email: string; emailVerified: number }>();
    if (!user) return error(401, 'invalid_token');
    const actor: Actor = {
      id: person,
      email: user.emailVerified ? user.email.toLowerCase() : null,
    };
    return answer(await createTeam(db, actor, body.name, Date.now(), body.organisation), 201);
  }

  // The invitations waiting for an account, for an app's Invites view (internal-invitations.ts).
  if (route === 'POST invitations') {
    const found = await pendingInvitations(db, await readBody(request));
    return found.ok ? json({ invitations: found.invitations }) : error(found.status, found.error);
  }

  if (route === 'POST tokens/revoke') {
    const { token } = await readBody(request);
    const found = typeof token === 'string' ? await tokenBySecret(db, token) : null;
    const revoked = typeof token === 'string' && (await revokeApiTokenBySecret(db, token));
    if (!revoked || !found) return error(404, 'invalid_token');
    await endTokenWorkbench(env, found.userId, found.id, waitUntil);
    return json({ ok: true });
  }

  if (route === 'POST tokens/live') {
    const { ids } = await readBody(request);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return error(400, 'ids_required');
    }
    if (ids.length > MAX_LIVE_TOKEN_IDS) return error(400, 'too_many_ids');
    return json({ live: await liveApiTokenIds(db, ids as string[]) });
  }

  // Someone's settings for one app. The app vouches for the owner, as it does for the teams it
  // applies from the feed: an id it has already verified (an access token's sub, or a guest token's).
  // It reaches only its own scope, beside 'all'.
  if (route === 'POST settings/read' || route === 'POST settings/write') {
    const body = await readBody(request);
    if (!isSettingsOwner(body.owner)) return error(400, 'invalid_owner');
    if (!isSettingsApp(body.app)) return error(400, 'invalid_app');
    if (!client.app) return error(403, 'client_has_no_app');
    if (body.app !== client.app) return error(403, 'wrong_app');
    // An app reading a guest's settings is that guest coming back to it, which keeps the guest's
    // rows from the idle sweep (guest-sweep.ts) however the app was handed the id.
    await noteGuestSeen(db, body.owner).catch((cause: unknown) =>
      console.error('[settings] guest seen failed', cause),
    );
    if (route === 'POST settings/read') return json(await readSettings(db, body.owner, body.app));
    const patch = body.patch ?? {};
    if (typeof patch !== 'object' || Array.isArray(patch)) return error(400, 'invalid_patch');
    const { all, app } = patch as { all?: unknown; app?: unknown };
    return answer(await writeSettings(db, body.owner, body.app, { all, app }));
  }

  // Display names and colours, for a presence list or a page of comments: up to MAX_PROFILE_IDS in
  // one query. Ids with neither a profile nor an account are left out.
  if (route === 'POST profiles/read') {
    const { ids } = await readBody(request);
    if (!Array.isArray(ids) || !ids.every(isProfileOwner)) return error(400, 'ids_required');
    if (ids.length > MAX_PROFILE_IDS) return error(400, 'too_many_ids');
    return json({ profiles: await readProfiles(db, ids) });
  }

  // Someone setting their own name or colour in an app. The app vouches for the owner, as for settings.
  if (route === 'POST profiles/write') {
    const body = await readBody(request);
    if (!isProfileOwner(body.owner)) return error(400, 'invalid_owner');
    const checked = checkProfilePatch(body);
    if (!checked.ok) return error(400, checked.error);
    await noteGuestSeen(db, body.owner).catch((cause: unknown) =>
      console.error('[profiles] guest seen failed', cause),
    );
    const result = await writeProfile(db, body.owner, checked.patch);
    return result.ok ? json({ profile: result.value }) : answer(result);
  }

  // This app seeing an account: answers whether it was the first time, which the app counts as a
  // sign-up. The app is the client's own.
  if (route === 'POST sightings') {
    const { userId } = await readBody(request);
    if (typeof userId !== 'string' || !USER_ID.test(userId)) return error(400, 'invalid_user');
    if (!client.app) return error(403, 'client_has_no_app');
    return json({ first: await recordSighting(db, userId, client.app) });
  }

  // A one-time milestone email of this app's, claimed before it is sent.
  if (route === 'POST milestones/claim') {
    const { userId, milestone } = await readBody(request);
    if (typeof userId !== 'string' || !USER_ID.test(userId)) return error(400, 'invalid_user');
    if (!isMilestone(milestone)) return error(400, 'invalid_milestone');
    if (!client.app) return error(403, 'client_has_no_app');
    return json({ claimed: await claimMilestone(db, userId, client.app, milestone) });
  }

  // Someone saved something they own at `at` (default now), in this app: the onboarding series' sense
  // of whether they have made anything, and when they were last active. A guest has no series: a no-op.
  if (route === 'POST activity') {
    const { userId, at } = await readBody(request);
    if (typeof userId !== 'string' || !(USER_ID.test(userId) || GUEST_ID.test(userId))) {
      return error(400, 'invalid_user');
    }
    const now = Date.now();
    if (at !== undefined && (typeof at !== 'number' || !Number.isFinite(at) || at <= 0)) {
      return error(400, 'invalid_at');
    }
    // Never in the future, so a skewed clock can't hold off the win-back.
    if (USER_ID.test(userId)) await recordActivity(db, userId, Math.min(at ?? now, now));
    return json({ ok: true });
  }

  // Where to reach these accounts by email, for the app's notifications: verified addresses only.
  if (route === 'POST emails') {
    const { ids } = await readBody(request);
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && USER_ID.test(id))) {
      return error(400, 'ids_required');
    }
    if (ids.length > MAX_EMAIL_IDS) return error(400, 'too_many_ids');
    return json({ emails: await verifiedEmails(db, ids as string[]) });
  }

  // Whether each of these accounts has turned a notification email off, for an email to many people
  // (a comment mentioning several teammates) in one read: their stored values of these `notify…`
  // switches, in `all` and the client's own app's scope.
  if (route === 'POST settings/notify') {
    const { owners, app, keys } = await readBody(request);
    if (
      !Array.isArray(owners) ||
      !owners.every((id) => typeof id === 'string' && USER_ID.test(id))
    ) {
      return error(400, 'owners_required');
    }
    if (owners.length > MAX_NOTIFY_OWNERS) return error(400, 'too_many_owners');
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_NOTIFY_KEYS) {
      return error(400, 'keys_required');
    }
    if (!keys.every(isNotifyKey)) return error(400, 'invalid_key');
    if (!isSettingsApp(app)) return error(400, 'invalid_app');
    if (!client.app) return error(403, 'client_has_no_app');
    if (app !== client.app) return error(403, 'wrong_app');
    return json({ settings: await readNotifySettings(db, owners as string[], app, keys) });
  }

  // A team's people, joined and invited, with their names: what an app checks a mention or an
  // assignment against, and offers a member of the team to pick from. The app shows them only to
  // someone its own token check says is in the team.
  if (route === 'POST teams/members') {
    const { teamId } = await readBody(request);
    if (typeof teamId !== 'string' || teamId.length === 0 || teamId.length > 100) {
      return error(400, 'invalid_team');
    }
    const found = await teamPeople(db, teamId);
    return found ? json(found) : error(404, 'not_found');
  }

  // The teams an account is in now, for an app whose token claim may be older than a team made or joined a
  // moment ago (@liveworkspace/index-app teams.ts). The same list an access token carries.
  if (route === 'POST teams/of') {
    const { userId } = await readBody(request);
    if (typeof userId !== 'string' || !USER_ID.test(userId)) return error(400, 'invalid_user');
    return json({ teams: await teamsClaim(db, userId) });
  }

  if (route === 'GET teams/changes') {
    return json(await teamChanges(db, url.searchParams.get('cursor')));
  }

  // A returning guest of the old livediagram.app, claimed by livediagram's api for the caller it verified
  // (legacy-guests.ts). A plain 404 until the old site's signing secret is set.
  if (route === 'POST legacy-guests/claim') {
    const secret = env.LEGACY_GUEST_ID_HMAC_SECRET?.trim();
    if (!secret) return error(404, 'not_found');
    if (client.app !== 'livediagram.app') return error(403, 'wrong_app');
    const body = await readBody(request);
    const limitKey = typeof body.into === 'string' ? body.into.slice(0, 100) : '';
    if (
      env.LEGACY_GUEST_LIMITER &&
      !(await env.LEGACY_GUEST_LIMITER.limit({ key: `claim:${limitKey}` })).success
    ) {
      return error(429, 'rate_limited');
    }
    const outcome = await claimLegacyGuest(legacyClaimConfig(env, secret), body);
    return json(outcome.body, outcome.status);
  }

  return error(404, 'not_found');
}
