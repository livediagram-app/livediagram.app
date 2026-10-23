// The account API under /api/account (liveworkspace/docs/accounts.md "Teams" and "API tokens"):
//   - for the signed-in person on liveworkspace.app, by their session cookie: their teams, members and
//     invitations, their API tokens, their settings shared by every app, and their profile;
//   - for the apps' servers, by their OAuth client credentials (/api/account/internal/*): checking an
//     API token, making one for a connecting AI tool, a token revoking itself, which tokens still
//     work, the teams change feed, a team made in an app, reading and writing someone's settings, and
//     reading profiles and setting one's own, an app's sign-ups and milestones, and accounts' emails.
import { AUTH_BASE_PATH } from './auth-options.ts';
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
import { USER_ID } from './ids.ts';
import {
  checkProfilePatch,
  isProfileOwner,
  MAX_PROFILE_IDS,
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

export async function handleAccountApi(request: Request, env: Env, auth: Auth): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.slice(ACCOUNT_API_PATH.length).split('/').filter(Boolean);
  if (parts[0] === 'internal') return handleInternal(request, env, auth, parts.slice(1), url);
  return handleSignedIn(request, env, auth, parts);
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
// must also come from the site itself.
function sameOrigin(request: Request, env: Env): boolean {
  return request.headers.get('origin') === new URL(env.BASE_URL).origin;
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
    if (result.ok && result.value.declined) {
      await tellAdmins(env, result.value.teamId, {
        teamName: result.value.teamName,
        responder: result.value.email,
        accepted: false,
      });
    }
    return result.ok
      ? json({ teamName: result.value.teamName, status: result.value.status })
      : error(result.status, result.error);
  }

  return null;
}

// A network: an IPv4 /24 or an IPv6 /48, so one machine can't dodge the limit by changing address.
function network(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':');
  return ip.split('.').slice(0, 3).join('.');
}

async function overLinkLimit(request: Request, env: Env): Promise<boolean> {
  if (!env.TEAM_LINK_LIMITER) return false;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  return !(await env.TEAM_LINK_LIMITER.limit({ key: `team-link:${network(ip)}` })).success;
}

// Someone answered an invitation: the team's admins hear of it, unless they turned it off. A failed
// email never fails the answer.
async function tellAdmins(
  env: Env,
  teamId: string,
  response: { teamName: string; responder: string; accepted: boolean },
): Promise<void> {
  try {
    const recipients = await inviteResponseRecipients(env.AUTH_DB, teamId);
    if (recipients.length) await sendInviteResponseEmails(env, recipients, response);
  } catch (cause) {
    console.error('[teams] invite response email failed', cause);
  }
}

async function handleSignedIn(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
): Promise<Response> {
  const { method } = request;
  if (method !== 'GET' && !sameOrigin(request, env)) return error(403, 'cross_origin');
  const open = await handleOpen(request, env, auth, parts);
  if (open) return open;
  const actor = await sessionActor(request, auth);
  if (!actor) return error(401, 'signed_out');
  const db = env.AUTH_DB;
  const [section, id, sub, subId, action] = parts;

  if (section === 'teams') {
    if (!id) {
      if (method === 'GET') {
        const [teams, invitations] = await Promise.all([
          listMyTeams(db, actor.id),
          listMyInvitations(db, actor.email),
        ]);
        return json({ teams, invitations });
      }
      if (method === 'POST') {
        const body = await readBody(request);
        return answer(await createTeam(db, actor, body.name, Date.now(), body.organisation), 201);
      }
    } else if (!sub) {
      if (method === 'PATCH') {
        const body = await readBody(request);
        return answer(
          await updateTeam(db, actor, id, { name: body.name, organisation: body.organisation }),
        );
      }
      if (method === 'DELETE') return answer(await deleteTeam(db, actor, id));
    } else if (sub === 'invite-link' && !subId) {
      // The team's join link: on (or a new one, ending the old), and off. Admins only.
      if (method === 'POST') {
        return answer(await makeInviteLink(db, actor, id, env.BETTER_AUTH_SECRET, env.BASE_URL));
      }
      if (method === 'DELETE') return answer(await clearInviteLink(db, actor, id));
    } else if (sub === 'members' && !action) {
      if (!subId) {
        if (method === 'GET') {
          const me = await getMembership(db, id, actor.id);
          if (!me) return error(404, 'not_found');
          const [members, inviteLink] = await Promise.all([
            listMembers(db, id),
            me.role === 'admin'
              ? currentInviteLink(db, id, env.BETTER_AUTH_SECRET, env.BASE_URL)
              : null,
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
        if (method === 'POST') {
          const body = await readBody(request);
          const result = await inviteMember(db, actor, id, body.email, body.role);
          if (result.ok) {
            await sendTeamInviteEmail(env, {
              to: result.value.member.email,
              teamName: result.value.teamName,
              inviterName: actor.name,
              declineToken: result.value.declineToken,
            }).catch((cause: unknown) => console.error('[teams] invite email failed', cause));
            return json(result.value.member, 201);
          }
          return answer(result);
        }
      } else {
        if (method === 'PATCH') {
          return answer(await setMemberRole(db, actor, id, subId, (await readBody(request)).role));
        }
        if (method === 'DELETE') return answer(await removeMember(db, actor, id, subId));
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
    if (result.ok) {
      await tellAdmins(env, result.value.teamId, {
        teamName: result.value.teamName,
        responder: actor.email ?? actor.name,
        accepted: result.value.status === 'joined',
      });
    }
    return answer(result);
  }

  // Joining through a team's join link. Its preview (GET) is open: handleOpen.
  if (section === 'join' && id && !sub && method === 'POST') {
    if (await overLinkLimit(request, env)) return error(429, 'rate_limited');
    return answer(await joinByInviteLink(db, actor, id));
  }

  if (section === 'tokens') {
    if (!id && method === 'GET') return json({ tokens: await listApiTokens(db, actor.id) });
    if (!id && method === 'POST') {
      const body = await readBody(request);
      const token = await mintApiToken(db, actor.id, {
        name: cleanTokenName(body.name, 'API token'),
        readOnly: body.readOnly === true,
      });
      return token ? json(token, 201) : error(409, 'token_limit_reached');
    }
    if (id && !sub && method === 'DELETE') {
      return (await revokeApiToken(db, actor.id, id)) ? json({ id }) : error(404, 'not_found');
    }
  }

  // Their display name and colour, the ones collaborators see in every app.
  if (section === 'profile' && !id) {
    if (method === 'GET') {
      const [profile] = await readProfiles(db, [actor.id]);
      return json({ profile: profile ?? null });
    }
    if (method === 'PATCH') {
      const checked = checkProfilePatch(await readBody(request));
      if (!checked.ok) return error(400, checked.error);
      const result = await writeProfile(db, actor.id, checked.patch);
      return result.ok ? json({ profile: result.value }) : answer(result);
    }
  }

  // The settings every app shows; each app's own are its server's to read and write.
  if (section === 'settings' && !id) {
    if (method === 'GET') {
      const { all, updatedAt } = await readSettings(db, actor.id, null);
      return json({ all, updatedAt });
    }
    if (method === 'PATCH') {
      const result = await writeSettings(db, actor.id, null, {
        all: (await readBody(request)).all,
      });
      return result.ok
        ? json({ all: result.value.all, updatedAt: result.value.updatedAt })
        : answer(result);
    }
  }

  return error(404, 'not_found');
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

interface Introspection {
  active?: boolean;
  sub?: unknown;
  client_id?: unknown;
}

// The account an access token belongs to, when it was minted for this very client and is still
// live (the provider's introspection checks both): how an app vouches for the person it acts for.
async function vouchedPerson(
  request: Request,
  auth: Auth,
  clientId: string,
  accessToken: unknown,
): Promise<string | Response> {
  if (typeof accessToken !== 'string') return error(400, 'access_token_required');
  const checked = await auth.handler(
    new Request(new URL(`${AUTH_BASE_PATH}/oauth2/introspect`, request.url), {
      method: 'POST',
      headers: {
        authorization: request.headers.get('authorization') ?? '',
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' }).toString(),
    }),
  );
  const result = (await checked.json().catch(() => ({}))) as Introspection;
  if (
    !checked.ok ||
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
): Promise<Response> {
  const db = env.AUTH_DB;
  const client = await verifiedClient(request, auth, db);
  if (!client) return error(401, 'invalid_client');
  const { clientId } = client;
  const route = `${request.method} ${parts.join('/')}`;

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
    const person = await vouchedPerson(request, auth, clientId, body.accessToken);
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
    const person = await vouchedPerson(request, auth, clientId, body.accessToken);
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

  if (route === 'POST tokens/revoke') {
    const { token } = await readBody(request);
    const revoked = typeof token === 'string' && (await revokeApiTokenBySecret(db, token));
    return revoked ? json({ ok: true }) : error(404, 'invalid_token');
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

  // Where to reach these accounts by email, for the app's notifications: verified addresses only.
  if (route === 'POST emails') {
    const { ids } = await readBody(request);
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && USER_ID.test(id))) {
      return error(400, 'ids_required');
    }
    if (ids.length > MAX_EMAIL_IDS) return error(400, 'too_many_ids');
    return json({ emails: await verifiedEmails(db, ids as string[]) });
  }

  if (route === 'GET teams/changes') {
    return json(await teamChanges(db, url.searchParams.get('cursor')));
  }

  return error(404, 'not_found');
}
