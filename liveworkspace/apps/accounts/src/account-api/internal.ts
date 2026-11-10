// The account API's door for the apps' servers, /api/account/internal/* (account-api.ts).

import { basicClientId } from '../app-caller.ts';
import { AUTH_BASE_PATH } from '../auth-options.ts';
import { introspectWithLegacy } from '../legacy-issuer.ts';
import { noteGuestSeen } from '../guest-sweep.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import {
  recordSighting,
  isMilestone,
  claimMilestone,
  MAX_EMAIL_IDS,
  verifiedEmails,
} from '../account-apps.ts';
import { clientApp } from '../clients.ts';
import { USER_ID, GUEST_ID } from '../ids.ts';
import { pendingInvitations } from '../internal-invitations.ts';
import { claimLegacyGuest, legacyClaimConfig } from '../legacy-guests.ts';
import { recordActivity } from '../lifecycle.ts';
import {
  MAX_NOTIFY_OWNERS,
  MAX_NOTIFY_KEYS,
  isNotifyKey,
  readNotifySettings,
  teamPeople,
} from '../notify.ts';
import {
  isProfileOwner,
  MAX_PROFILE_IDS,
  readProfiles,
  checkProfilePatch,
  writeProfile,
} from '../profiles.ts';
import {
  type SettingsApp,
  isSettingsOwner,
  isSettingsApp,
  readSettings,
  writeSettings,
} from '../settings.ts';
import { teamsClaim, type Actor, createTeam, teamChanges } from '../teams.ts';
import {
  verifyApiToken,
  mintApiToken,
  cleanTokenName,
  revokeApiTokenBySecret,
  MAX_LIVE_TOKEN_IDS,
  liveApiTokenIds,
} from '../tokens.ts';
import { pushInternal } from '../push/routes.ts';
import { handleWorkbenchInternal } from '../workbench/internal.ts';
import { tokenBySecret, endTokenWorkbench } from '../workbench/revoke.ts';
import { answer, error, json, readBody, type WaitUntil } from './http.ts';

// --- The apps' servers ---

// Client credentials already checked in this isolate, by a hash of the header, with the app the
// client is, so an app's burst of token checks costs one credential check, not one each.
const CLIENT_CHECK_TTL_MS = 5 * 60_000;
type CheckedClient = { clientId: string; app: SettingsApp | null };
const checkedClients = new Map<string, CheckedClient & { until: number }>();

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

export async function handleInternal(
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

  // Phone notifications an app has decided on, sent after the answer (push/routes.ts).
  if (route === 'POST push') return pushInternal(request, env, client.app, waitUntil);

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
