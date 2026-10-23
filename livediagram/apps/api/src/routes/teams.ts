// /api/teams (docs/specs/013-workspace/teams.md) — the caller's teams, for reading.
//
// Teams are run on liveworkspace.app (liveworkspace/docs/accounts.md "Teams"), the same team in every
// app. This app reads its copy (db/team-sync.ts): the list, a team and its members, its library, and
// the access checks and notices its documents use. Making a team is the one write: liveworkspace makes
// it for the person signed in (createTeamFor), and the copy takes it at once (team-create.ts).
// Renaming and deleting a team, invitations, roles and leaving answer 410 with where to go.
//
// Two verified credentials reach it (docs/specs/015-api/public-api-and-tokens.md §3.4): an account
// access token, or an API token (its owner is always an account), so an integration can list the
// caller's teams and read their shared libraries like the app does.

import {
  getMembership,
  getTeam,
  listDocumentsByTeam,
  listFoldersByTeam,
  listTeamMembers,
  listTeamsByUser,
} from '../db';
import { forbidden, json, notFound, signInRequired } from '../responses';
import { handleTeamActionRoutes } from './team-action-routes';
import { createTeam } from './team-create';
import { handleTeamMentionRoutes } from './team-mention-routes';
import type { RouteContext } from './context';

export async function handleTeams(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, accountUserId, verifiedUserId } = ctx;
  if (segments[1] !== 'teams') return notFound();
  if (managedOnLiveworkspace(request.method, segments)) return teamsMoved(ctx);
  const userId = verifiedUserId;
  if (!userId) return signInRequired();
  // Read vs write (docs/specs/015-api/public-api-and-tokens.md §3.4): an API token reads, but the
  // writes left here (a team's notices) need the interactive signed-in session.
  if (request.method !== 'GET' && !accountUserId) return signInRequired();

  // /api/teams — the teams the caller has joined; POST makes one.
  if (segments.length === 2) {
    if (request.method === 'POST') return createTeam(ctx);
    if (request.method !== 'GET') return notFound();
    return json({ teams: await listTeamsByUser(env, userId) });
  }

  // /api/teams/invites — invitations are answered on liveworkspace.app, so there are none here.
  if (segments.length === 3 && segments[2] === 'invites') {
    return request.method === 'GET' ? json({ invites: [] }) : notFound();
  }

  // Everything below is team-scoped: resolve the team and the caller's membership once. Non-members
  // get 404 (not 403) so a team id can't be probed for existence. Route before loading: a path no
  // team-scoped route below serves 404s here rather than after two D1 reads.
  const teamScoped =
    segments.length === 3 ||
    (segments.length === 4 &&
      (segments[3] === 'library' ||
        segments[3] === 'access-check' ||
        segments[3] === 'notify-action' ||
        segments[3] === 'notify-mention'));
  if (!teamScoped) return notFound();
  const teamId = segments[2]!;
  const team = await getTeam(env, teamId);
  if (!team) return notFound();
  const me = await getMembership(env, teamId, userId);
  if (!me) return notFound();

  // /api/teams/<id>/library — the team's shared folder tree + documents
  // (docs/specs/013-workspace/team-shared-documents.md), for joined members.
  if (segments.length === 4 && segments[3] === 'library') {
    if (request.method !== 'GET') return notFound();
    if (me.status !== 'joined') return forbidden();
    const [folders, liveDocs] = await Promise.all([
      listFoldersByTeam(env, teamId),
      listDocumentsByTeam(env, teamId),
    ]);
    return json({ folders, documents: liveDocs });
  }

  // /api/teams/<id> — the team, its members and the caller's role.
  if (segments.length === 3) {
    if (request.method !== 'GET') return notFound();
    const members = await listTeamMembers(env, teamId);
    // Invite links are gone: people are invited by email on liveworkspace.app.
    return json({ team, members, myRole: me.role, inviteLink: null });
  }

  // The assigned-actions endpoints (docs/specs/012-collaboration/assigned-actions.md): /access-check +
  // /notify-action — see team-action-routes.ts.
  const actionResp = await handleTeamActionRoutes(ctx, { teamId, me, userId });
  if (actionResp) return actionResp;
  // Comment mentions (docs/specs/012-collaboration/comment-mentions.md): /notify-mention.
  const mentionResp = await handleTeamMentionRoutes(ctx, { teamId, me, userId });
  if (mentionResp) return mentionResp;

  return notFound();
}

// What liveworkspace.app runs now: exactly the administration routes this API used to serve.
function managedOnLiveworkspace(method: string, segments: string[]): boolean {
  switch (segments.length) {
    case 3:
      return method === 'PUT' || method === 'DELETE';
    case 4:
      if (segments[2] === 'invite-link') return method === 'GET';
      if (segments[2] === 'invite-decline') return method === 'GET' || method === 'POST';
      if (segments[3] === 'invite-link') return method === 'POST' || method === 'DELETE';
      return segments[3] === 'members' && method === 'POST';
    case 5:
      if (segments[2] === 'invite-link') return segments[4] === 'join' && method === 'POST';
      return segments[3] === 'members' && (method === 'PUT' || method === 'DELETE');
    case 6:
      return segments[3] === 'members' && segments[5] === 'accept' && method === 'POST';
    default:
      return false;
  }
}

function teamsMoved(ctx: RouteContext): Response {
  const accounts = (ctx.env.ACCOUNTS_URL ?? 'https://liveworkspace.app').replace(/\/+$/, '');
  return json({ error: 'teams_moved', manageAt: `${accounts}/account/teams` }, { status: 410 });
}
