// The caller's teams (from its token: liveworkspace manages them), a team's library, for API clients
// (index-adapters.ts), and a team's people, for the editor's assignee picker and @-mention list
// (assigned-actions.md, comment-mentions.md). Making a team is the one write: liveworkspace makes it for the
// person signed in (team-create.ts, createTeamFor).

import type { TeamListItem, TeamMember } from '@livehuddle/api-schema';
import { accountsTeamReader, createTeamAccess } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import { teamPeople } from '../liveworkspace/team-people';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { createTeam } from './team-create';
import { handleTeamNotifyRoutes } from './team-notify-routes';
import { listTeamInvites } from './team-invites';
import { clientFor, folderOf, listFolders, listItems, refusal, summaryOf } from './index-adapters';

// Team access as every app on the index has it (@liveworkspace/index-app teams.ts): the token's claim, and accounts
// for a team made or joined since it was minted.
const teamAccess = createTeamAccess();

const NOTIFY_ROUTES = new Set(['access-check', 'notify-action', 'notify-mention']);

// GET /api/teams, /api/teams/invites, /api/teams/:id/library and /api/teams/:id/members, POST /api/teams, and the
// team's access-check, notify-action and notify-mention.
// Teams are the caller's token's (liveworkspace manages them).
export async function handleTeams(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (segments.length === 2 && request.method === 'POST') return createTeam(ctx);
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  // The assigned-actions and mentions endpoints (team-notify-routes.ts), for someone in the team.
  if (segments.length === 4 && NOTIFY_ROUTES.has(segments[3]!)) {
    const teamId = segments[2]!;
    if (!(await inTeam(ctx, owner, teamId))) return notFound();
    return (await handleTeamNotifyRoutes(ctx, teamId, owner)) ?? notFound();
  }
  if (request.method !== 'GET') return notFound();
  const teams = ctx.teams ?? [];
  if (segments.length === 2) {
    const list: TeamListItem[] = teams.map((t) => ({
      id: t.id,
      name: t.name,
      organisation: null,
      createdAt: 0,
      updatedAt: 0,
      myRole: t.role,
      memberCount: 0,
    }));
    return json({ teams: list });
  }
  // /api/teams/invites — the invitations waiting for the caller, answered on liveworkspace.app.
  if (segments.length === 3 && segments[2] === 'invites') return listTeamInvites(ctx, owner);
  if (segments.length === 4 && segments[3] === 'library') {
    const teamId = segments[2]!;
    if (!(await inTeam(ctx, owner, teamId))) return notFound();
    const client = clientFor(ctx);
    if (client instanceof Response) return client;
    try {
      const [items, folders] = await Promise.all([
        listItems(client, teamId),
        listFolders(client, teamId),
      ]);
      return json({ documents: items.map(summaryOf), folders: folders.map(folderOf) });
    } catch (err) {
      return refusal(err);
    }
  }
  // A team's joined and invited people, for someone in it (never an API token: the people are not part of the
  // public API). Their names are accounts' profiles; an invited person's is null until they join.
  if (segments.length === 4 && segments[3] === 'members') {
    const teamId = segments[2]!;
    // A team the caller is not in answers as missing, by name, whoever asks.
    const noTeam = () => json({ error: 'team_not_found' }, { status: 404 });
    if (ctx.token || !(await inTeam(ctx, owner, teamId))) return noTeam();
    const people = await teamPeople(ctx.env, teamId);
    if (!people) return noTeam();
    const members: TeamMember[] = people.map((p) => ({
      id: p.id,
      teamId,
      userId: p.userId,
      email: p.email,
      role: p.role,
      status: p.status,
      name: p.name,
      createdAt: 0,
      updatedAt: 0,
    }));
    return json({ members });
  }
  return notFound();
}

function inTeam(ctx: RouteContext, owner: string, teamId: string): Promise<boolean> {
  return teamAccess.inTeam(
    accountsTeamReader(accountCredentials(ctx.env)),
    owner,
    ctx.teams ?? null,
    teamId,
  );
}
