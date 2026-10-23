// POST /api/teams `{ name, organisation? }` (docs/specs/013-workspace/teams.md "Making a team"): makes a
// team for the person signed in, on liveworkspace, with them as its admin (liveworkspace/docs/
// accounts.md "Teams", createTeamFor). It is the same team on liveworkspace.app and in every app; it is
// managed there. The team goes into this app's copy at once (mirrorCreatedTeam), so a document can be
// filed into it straight away.
//
// The interactive session only (an API token or a workbench can't make one), and the app vouches for
// the person with the access token they sent.

import { bearerTokenOf, type Team } from '@livediagram/api-schema';
import { createTeamFor, TeamError } from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import { mirrorCreatedTeam } from '../db/team-sync';
import { badRequest, json, signInRequired } from '../responses';
import { readBody, type RouteContext } from './context';

// A team's name and organisation, as liveworkspace caps them: longer is cut, as it cuts them.
const TEAM_NAME_MAX = 80;
const TEAM_ORGANISATION_MAX = 80;

export async function createTeam(ctx: RouteContext): Promise<Response> {
  const { request, env, accountUserId } = ctx;
  const accessToken = bearerTokenOf(request.headers.get('Authorization'));
  if (!accountUserId || !accessToken) return signInRequired();
  const credentials = accountCredentials(env);
  if (!credentials) return json({ error: 'teams_not_configured' }, { status: 503 });
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  const body = read as { name?: unknown; organisation?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, TEAM_NAME_MAX) : '';
  if (!name) return badRequest('name_required');
  const organisation =
    typeof body.organisation === 'string'
      ? body.organisation.trim().slice(0, TEAM_ORGANISATION_MAX) || null
      : null;
  let made;
  try {
    made = await createTeamFor(credentials, { accessToken, name, organisation });
  } catch (err) {
    if (err instanceof TeamError) {
      console.warn('[teams] create_refused', { status: err.status, code: err.code });
      return json({ error: err.code }, { status: err.status === 401 ? 401 : err.status });
    }
    console.error('[teams] create_failed', String(err));
    return json({ error: 'teams_unavailable' }, { status: 503 });
  }
  const now = Date.now();
  await mirrorCreatedTeam(env, accountUserId, made, now);
  console.info('[teams] created');
  const team: Team = {
    id: made.id,
    name: made.name,
    organisation: made.organisation,
    createdAt: now,
    updatedAt: now,
  };
  return json({ team }, { status: 201 });
}
