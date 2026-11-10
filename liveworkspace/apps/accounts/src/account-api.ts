// The account API under /api/account (liveworkspace/docs/specs/003-accounts/accounts.md "Teams" and "API tokens"):
//   - for the signed-in person on liveworkspace.app, by their session cookie: their teams, members and
//     invitations, their API tokens, their settings shared by every app (and resetting all of them), and their profile;
//   - for the apps' servers, by their OAuth client credentials (/api/account/internal/*): checking an
//     API token, making one for a connecting AI tool, a token revoking itself, which tokens still
//     work, the teams change feed, a team made in an app, reading and writing someone's settings, and
//     reading profiles and setting one's own, an app's sign-ups and milestones, accounts' emails, and
//     for notification emails, many people's notify switches at once and a team's people; and for livediagram's
//     api, a returning guest of the old livediagram.app claimed (legacy-guests.ts).
//   - for an app's Settings, by the app's bearer (bearer.ts): the same teams, settings, profile, phone devices, API
//     tokens and Download Your Data, and the account's sessions and sign-in methods (own-sessions.ts, link-google.ts);
//   - workbenches, for every app (/api/account/workbench/*, workbench/routes.ts), and the apps' servers' checks of
//     their sessions (workbench/internal.ts).

import { bearerOf } from './bearer.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import { handleWorkbench } from './workbench/routes.ts';
import { handleDataExportReady, handleDataExportDownload } from './data-export/routes.ts';
import type { WaitUntil } from './account-api/http.ts';
import { handleSignedIn, sessionActor } from './account-api/signed-in.ts';
import { handleInternal } from './account-api/internal.ts';
import { handleIndexPeople, handleIndexTeams } from './account-api/index-door.ts';
import { handleBearer } from './account-api/bearer-door.ts';

export const ACCOUNT_API_PATH = '/api/account';

export async function handleAccountApi(
  request: Request,
  env: Env,
  auth: Auth,
  waitUntil: WaitUntil = (promise) => void promise,
): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.slice(ACCOUNT_API_PATH.length).split('/').filter(Boolean);
  // Download Your Data (data-export/routes.ts): the export service's call when one finishes, with its own key, and
  // the emailed link, which sends someone signed out to sign in rather than answering 401.
  if (
    parts[0] === 'internal' &&
    parts[1] === 'data-export' &&
    parts[2] === 'ready' &&
    parts.length === 3
  ) {
    return handleDataExportReady(request, env);
  }
  if (
    parts[0] === 'data-export' &&
    parts[1] === 'download' &&
    parts.length === 2 &&
    request.method === 'GET'
  ) {
    return handleDataExportDownload(request, env, (r) => sessionActor(r, auth));
  }
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
  if (parts[0] === 'index' && parts[1] === 'people' && parts.length === 2) {
    return handleIndexPeople(request, env);
  }
  const bearer = bearerOf(request);
  if (bearer) return handleBearer(request, env, auth, parts, bearer, waitUntil);
  return handleSignedIn(request, env, auth, parts, waitUntil);
}
