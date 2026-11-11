// The account API's door for the signed-in person on liveworkspace.app (account-api.ts).

import { storageOutageOf } from '@liveworkspace/api-kit/request-failure';
import { sameSiteOrigin } from '@liveworkspace/sites/www';
import { guestOfRequest } from '../guests.ts';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { signupAppOf } from '../lifecycle.ts';
import { resetSettings } from '../settings.ts';
import {
  type Actor,
  previewInviteLink,
  readDeclineToken,
  declineByToken,
  joinByInviteLink,
} from '../teams.ts';
import { pushDeviceRoutes } from '../push/routes.ts';
import { reportServerEvent } from '../telemetry.ts';
import { handleDataExport } from '../data-export/routes.ts';
import { answer, error, json, type WaitUntil } from './http.ts';
import { overLinkLimit, patchSharedSettings, peopleNames, tellAdmins } from './shared.ts';
import {
  appSettings,
  profileRoute,
  sharedSettings,
  teamRoutes,
  tokenRoutes,
} from './both-doors.ts';

// --- The signed-in person, on liveworkspace.app ---

export async function sessionActor(
  request: Request,
  auth: Auth,
): Promise<(Actor & { name: string }) | null> {
  // No session is someone signed out; the database itself down is no answer at all, so it goes on to the request-failure
  // guard (a 503) rather than read as signed out.
  const session = await auth.api.getSession({ headers: request.headers }).catch((err: unknown) => {
    if (storageOutageOf(err)) throw err;
    return null;
  });
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

export async function handleSignedIn(
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

  const tokens = await tokenRoutes(request, env, actor.id, parts, waitUntil);
  if (tokens) return tokens;

  // Other people's display names and pictures, by id (the Explorer's Owner column, its Inbox and History).
  if (section === 'people' && !id && method === 'GET') {
    return peopleNames(request, db, { pictures: true });
  }

  // The devices they get phone notifications on (push/routes.ts).
  const push = await pushDeviceRoutes(request, env, actor.id, parts);
  if (push) return push;

  // Their display name and colour, the ones collaborators see in every app.
  if (section === 'profile' && !id) {
    const answered = await profileRoute(request, db, actor.id);
    if (answered) return answered;
  }

  // Download Your Data: theirs, and each team's they administer (data-export/routes.ts).
  if (section === 'data-export' && !id) return handleDataExport(request, env, actor);

  // The settings every app shows; each app's own are its server's to read and write.
  if (section === 'settings' && !id) {
    if (method === 'GET') return sharedSettings(db, actor);
    if (method === 'PATCH') return patchSharedSettings(request, db, actor);
    // Reset All Settings: every scope of the person's own, back to its defaults.
    if (method === 'DELETE') return json(await resetSettings(db, actor.id));
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
