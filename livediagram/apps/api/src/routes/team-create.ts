// POST /api/teams `{ name, organisation? }` (docs/specs/013-workspace/teams.md "Making a team"): makes a
// team for the person signed in, on liveworkspace, with them as its admin (@liveworkspace/index-app makeTeamFor).
// It is the same team on liveworkspace.app and in every app, managed there, and usable at once, so a canvas
// can be filed into it straight away.
//
// The interactive session only (an API token or a workbench can't make one), and the app vouches for
// the person with the access token they sent.

import { bearerTokenOf } from '@livediagram/api-schema';
import { makeTeamFor } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import { json, signInRequired } from '../responses';
import { readBody, type RouteContext } from './context';

export async function createTeam(ctx: RouteContext): Promise<Response> {
  const { request, env, accountUserId } = ctx;
  const accessToken = bearerTokenOf(request.headers.get('Authorization'));
  if (!accountUserId || !accessToken) return signInRequired();
  const credentials = accountCredentials(env);
  if (!credentials) return json({ error: 'teams_not_configured' }, { status: 503 });
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const made = await makeTeamFor(credentials, accessToken, body);
  return json(made.body, { status: made.status });
}
