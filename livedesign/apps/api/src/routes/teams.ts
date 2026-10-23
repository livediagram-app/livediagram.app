// The caller's teams (from its token: liveworkspace manages them), a team's library, for API clients
// (index-adapters.ts), and a team's people, for the editor's assignee picker and @-mention list
// (assigned-actions.md, comment-mentions.md). Making a team is the one write: liveworkspace makes it for the
// person signed in (team-create.ts). Renaming and deleting a team, invitations, roles and leaving are
// liveworkspace.app's, and answer 410 with where to go.

import type { TeamListItem, TeamMember } from '@livedesign/api-schema';
import { accountsTeamReader, createTeamAccess } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import { teamPeople } from '../accounts/notify';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { createTeam } from './team-create';
import { clientFor, folderOf, listFolders, listItems, refusal, summaryOf } from './index-adapters';
import { listTeamInvites } from './team-invites';

// Team access as every app on the index has it (@liveworkspace/index-app teams.ts): the token's claim, and accounts
// for a team made or joined since it was minted.
const teamAccess = createTeamAccess();

// GET /api/teams, /api/teams/invites, /api/teams/:id/library and /api/teams/:id/members. Teams are the caller's token's
// (liveworkspace manages them).
export async function handleTeams(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  if (managedOnLiveworkspace(request.method, segments)) return teamsMoved(ctx);
  if (segments.length === 2 && request.method === 'POST') return createTeam(ctx);
  if (request.method !== 'GET') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
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
  // /api/teams/invites: the invitations waiting for the caller, answered on liveworkspace.app.
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
      return json({ designs: items.map(summaryOf), folders: folders.map(folderOf) });
    } catch (err) {
      return refusal(err);
    }
  }
  // A team's joined and invited people, for someone in it (never an API token: the people are not part of the
  // public API). Their names are accounts' profiles; an invited person's is null until they join.
  if (segments.length === 4 && segments[3] === 'members' && segments[2] !== 'invites') {
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

// What liveworkspace.app runs: exactly the administration routes this API used to serve.
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

function inTeam(ctx: RouteContext, owner: string, teamId: string): Promise<boolean> {
  return teamAccess.inTeam(
    accountsTeamReader(accountCredentials(ctx.env)),
    owner,
    ctx.teams ?? null,
    teamId,
  );
}
