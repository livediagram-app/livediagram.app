// /api/trash (docs/specs/013-workspace/trash.md, "The API"):
//   GET    /api/trash               what the caller may restore (personal + joined teams)
//   POST   /api/trash/<id>/restore  bring one back
//   DELETE /api/trash/<id>          purge one for good
//   DELETE /api/trash[?team=<id>]   empty the personal Trash, or one team's
//
// The authority is exactly the delete authority (mayDeleteDiagram): the owner
// of a personal diagram, any joined member of a team diagram's team. Anything
// else, like a diagram that isn't in the Trash, answers the 404 of a missing id.

import {
  getDiagram,
  getMembership,
  getTrashedDiagramMeta,
  listTrash,
  purgeDiagrams,
  restoreDiagram,
  trashIdsFor,
} from '../db';
import { json, noContent, notFound } from '../responses';
import { redactDiagramForReader } from '../redact-diagram';
import { mayDeleteDiagram, requireOwner, type RouteContext } from './context';

export async function handleTrash(ctx: RouteContext): Promise<Response> {
  const { request, env, segments, url } = ctx;
  if (segments[1] !== 'trash') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  if (segments.length === 2) {
    if (request.method === 'GET') {
      return json({ trash: await listTrash(env, { owner, verifiedUserId: ctx.verifiedUserId }) });
    }
    if (request.method === 'DELETE') {
      const teamId = url.searchParams.get('team');
      if (teamId !== null && !(await joined(ctx, teamId))) return notFound();
      const ids = await trashIdsFor(env, teamId !== null ? { teamId } : { owner });
      const purged = await purgeDiagrams(env, ids);
      console.info('[trash] emptied', teamId !== null ? `team:${teamId}` : 'personal', purged);
      return json({ purged });
    }
    return notFound();
  }

  const restore = segments.length === 4 && segments[3] === 'restore' && request.method === 'POST';
  const purge = segments.length === 3 && request.method === 'DELETE';
  if (!restore && !purge) return notFound();

  const id = segments[2]!;
  const binned = await getTrashedDiagramMeta(env, id);
  const allowed = binned !== null && (await mayDeleteDiagram(ctx, binned));
  if (!allowed) return notFound();

  if (restore) {
    await restoreDiagram(env, id);
    const diagram = await getDiagram(env, id);
    console.info('[trash] restored', id);
    return json({ diagram: diagram ? redactDiagramForReader(diagram, owner) : null });
  }

  await purgeDiagrams(env, [id]);
  console.info('[trash] purged from the Trash', id);
  return noContent();
}

// A team Trash belongs to the team's joined members, checked against the
// server-verified account id only (docs/specs/013-workspace/team-shared-diagrams.md).
async function joined(ctx: RouteContext, teamId: string): Promise<boolean> {
  if (!ctx.verifiedUserId) return false;
  const membership = await getMembership(ctx.env, teamId, ctx.verifiedUserId);
  return membership?.status === 'joined';
}
