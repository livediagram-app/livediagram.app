// The caller's teams (from its token: liveworkspace manages them) and a team's library, for API clients
// (index-adapters.ts).

import type { TeamListItem } from '@liveplanner/api-schema';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { clientFor, folderOf, listFolders, listItems, refusal, summaryOf } from './index-adapters';

// GET /api/teams and /api/teams/:id/library. Teams are the caller's token's (liveworkspace manages them).
export async function handleTeams(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
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
  if (segments.length === 4 && segments[3] === 'library') {
    const teamId = segments[2]!;
    if (!teams.some((t) => t.id === teamId)) return notFound();
    const client = clientFor(ctx);
    if (client instanceof Response) return client;
    try {
      const [items, folders] = await Promise.all([
        listItems(client, teamId),
        listFolders(client, teamId),
      ]);
      return json({ projects: items.map(summaryOf), folders: folders.map(folderOf) });
    } catch (err) {
      return refusal(err);
    }
  }
  return notFound();
}
