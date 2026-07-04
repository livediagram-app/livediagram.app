// /api/diagrams/<id>/folder — placement (spec/15 + spec/35), split out
// of routes/diagrams.ts: the scope-change policy is the densest rule
// block under the diagram resource, so it owns its own module the way
// the tab / share sub-paths own diagram-subresource-routes.ts.

import { getDiagram, getFolder, getMembership, setDiagramFolder } from '../db';
import { forbidden, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';

// Returns null when the request isn't the placement route.
export async function handleDiagramPlacement(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // /api/diagrams/<id>/folder — placement (spec/15 + spec/35). Body:
  // { folderId, teamId? }. A team diagram is managed by every joined
  // member (spec/35), so the rules are by membership, not ownership:
  //   - INTO a team (or between teams): caller must be a joined
  //     member of the destination team; if the diagram is currently
  //     personal, only its owner may file it into a team; if it's in
  //     another team, the caller must be a joined member of that team
  //     too.
  //   - WITHIN the current team: any joined member may re-folder it.
  //   - OUT of a team to personal: any joined member may move it into
  //     THEIR OWN personal library; ownership transfers to the mover
  //     (folders are owner-scoped, so the row follows). The owner
  //     moving it out keeps ownership.
  //   - A purely personal move (no team on either side) stays owner-
  //     only.
  // Folder existence + scope match is validated before the write so
  // the diagram never points at a folder outside its scope.
  if (segments.length === 4 && segments[3] === 'folder') {
    const id = segments[2]!;
    if (request.method === 'PUT') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDiagram(env, id);
      if (!existing) return notFound();
      const body = (await request.json()) as { folderId?: string | null; teamId?: string | null };
      const folderId = body.folderId ?? null;
      const teamId = body.teamId !== undefined ? body.teamId : existing.teamId;
      const isOwner = existing.ownerId === owner;
      const caller = ctx.verifiedUserId;

      if (teamId !== existing.teamId) {
        // Changing scope.
        if (teamId !== null) {
          // Into a team / between teams: joined member of the
          // destination. A personal diagram can only be filed in by
          // its owner; a team diagram can be moved by any joined
          // member of its current team.
          if (!caller) return forbidden();
          const dest = await getMembership(env, teamId, caller);
          if (dest?.status !== 'joined') return forbidden();
          if (existing.teamId === null) {
            if (!isOwner) return forbidden();
          } else {
            const src = await getMembership(env, existing.teamId, caller);
            if (src?.status !== 'joined') return forbidden();
          }
        } else if (!isOwner) {
          // Out of a team to personal: any joined member of the
          // current team (it becomes the mover's personal diagram).
          if (!caller || !existing.teamId) return forbidden();
          const membership = await getMembership(env, existing.teamId, caller);
          if (membership?.status !== 'joined') return forbidden();
        }
      } else if (!isOwner) {
        // Same scope, non-owner: only legal inside a team the caller
        // has joined (re-foldering a teammate's diagram).
        if (!caller || !existing.teamId) return forbidden();
        const membership = await getMembership(env, existing.teamId, caller);
        if (membership?.status !== 'joined') return forbidden();
      }

      // A non-owner moving a team diagram out to personal takes
      // ownership (spec/35): the diagram lands in the mover's library.
      const movingOutToPersonal = teamId === null && existing.teamId !== null;
      const newOwnerId = movingOutToPersonal && !isOwner ? caller! : undefined;
      // Whose personal folder a personal placement must belong to.
      const personalOwner = newOwnerId ?? existing.ownerId;

      if (folderId !== null) {
        const folder = await getFolder(env, folderId);
        if (!folder) return notFound();
        // Scope match: personal placement needs that owner's personal
        // folder; team placement needs a folder of that team.
        if (teamId === null && (folder.teamId !== null || folder.ownerId !== personalOwner)) {
          return notFound();
        }
        if (teamId !== null && folder.teamId !== teamId) return notFound();
      }
      await setDiagramFolder(env, id, folderId, teamId, newOwnerId);
      return noContent();
    }
  }
  return null;
}
