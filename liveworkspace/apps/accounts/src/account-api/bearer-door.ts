// The account API's door for an app's bearer (account-api.ts).

import { bearerPerson, bearerSessionId } from '../bearer.ts';
import { listOwnSessions, endOtherSessions, endOwnSession } from '../own-sessions.ts';
import { signInMethods, startGoogleLink } from '../link-google.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { resetSettings } from '../settings.ts';
import { pushDeviceRoutes } from '../push/routes.ts';
import { handleDataExport } from '../data-export/routes.ts';
import { error, json, type WaitUntil } from './http.ts';
import {
  accountName,
  overLinkLimit,
  patchSharedSettings,
  peopleNames,
  type Reader,
} from './shared.ts';
import {
  appSettings,
  profileRoute,
  sharedSettings,
  teamRoutes,
  tokenRoutes,
} from './both-doors.ts';

// --- The Explorer on an app's own address, by the app's bearer (bearer.ts) ---

// What that page and the editors' Explorer panels and Settings need: names for a guest or an account, and for an
// account its settings (the shared scope and each app's, read and patched), its profile (profileRoute: the app's API
// already sets the same name and colour with this token, PUT /api/participants/:id, so this grants nothing new) and
// its teams, run in place (teamRoutes). And so that no setting sends anyone to liveworkspace.app, its API tokens and
// Download Your Data (the session door's own handlers), and its sessions and sign-in methods: the owner accepted that
// a stolen access token gains these until it lapses (liveworkspace/docs/specs/003-accounts/accounts.md "Every account
// setting in every app"). Only an account's access token passes: a guest stops below, and an API token is no JWT, so
// bearerPerson refuses it. A bearer is no ambient credential, so a write needs no same-origin check: a page can only
// send one it holds. Joining by link stays the session's.
export async function handleBearer(
  request: Request,
  env: Env,
  auth: Auth,
  parts: string[],
  token: string,
  waitUntil: WaitUntil,
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
  // Its Danger Zone's Reset All Settings, for the account the token is (a guest stopped above).
  if (section === 'settings' && !id && method === 'DELETE') {
    return json(await resetSettings(db, actor.id));
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
  // And its Phone section registers this device and lists and removes the rest (push/routes.ts).
  const push = await pushDeviceRoutes(request, env, actor.id, parts);
  if (push) return push;
  const tokens = await tokenRoutes(request, env, actor.id, parts, waitUntil);
  if (tokens) return tokens;
  // Download Your Data, with the actor the session's door builds (sessionActor). The emailed link still needs the
  // session (handleDataExportDownload).
  if (section === 'data-export' && !id) {
    return handleDataExport(request, env, { ...actor, name: await accountName(db, actor.id) });
  }
  // Where You're Signed In (own-sessions.ts). `sid` is the session this access token was minted under.
  if (section === 'sessions') {
    const current = bearerSessionId(token);
    if (!id && method === 'GET') {
      return json({ sessions: await listOwnSessions(db, actor.id, current) });
    }
    if (id === 'revoke-others' && !sub && method === 'POST') {
      if (!current) return error(409, 'no_current_session');
      return json({ ended: await endOtherSessions(db, actor.id, current) });
    }
    if (id && !sub && method === 'DELETE') {
      return (await endOwnSession(db, actor.id, id)) ? json({ id }) : error(404, 'not_found');
    }
  }
  // Sign-in Methods (link-google.ts).
  if (section === 'sign-in-methods') {
    if (!id && method === 'GET') return signInMethods(env, actor.id);
    if (id === 'google' && !sub && method === 'POST') {
      return startGoogleLink(request, env, actor.id, bearerSessionId(token));
    }
  }
  return error(404, 'not_found');
}
