// /api/designs/<id>/folder — placement (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-designs.md), split out
// of routes/designs.ts: the scope-change policy is the densest rule
// block under the design resource, so it owns its own module the way
// the tab / share sub-paths own design-subresource-routes.ts.

import {
  getDesign,
  getFolder,
  getMembership,
  getParticipant,
  getTeam,
  setDesignFolder,
} from '../db';
import { badRequest, forbidden, noContent, notFound } from '../responses';
import {
  audienceForDesign,
  recordDesignMoved,
  recordTeamDesignAdded,
  recordTeamDesignRemoved,
} from '../timeline';
import {
  missingDesign,
  ownsDesign,
  requireOwner,
  type RouteContext,
  readBody,
} from './context';

// Returns null when the request isn't the placement route.
// A placement field as sent: an id, null, or absent.
const isIdOrNull = (v: unknown): v is string | null | undefined =>
  v === undefined || v === null || typeof v === 'string';

export async function handleDesignPlacement(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  // /api/designs/<id>/folder — placement (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-designs.md). Body:
  // { folderId, teamId? }. A team design is managed by every joined
  // member (docs/specs/013-workspace/team-shared-designs.md), so the rules are by membership, not ownership:
  //   - INTO a team (or between teams): caller must be a joined
  //     member of the destination team; if the design is currently
  //     personal, only its owner may file it into a team; if it's in
  //     another team, the caller must be a joined member of that team
  //     too.
  //   - WITHIN the current team: any joined member may re-folder it.
  //   - BETWEEN teams: a joined member of both may move it; when its owner
  //     is not a joined member of the destination, ownership transfers to
  //     the mover, so the design never stays owned from outside its team.
  //   - OUT of a team to personal: any joined member may move it into
  //     THEIR OWN personal library; ownership transfers to the mover
  //     (folders are owner-scoped, so the row follows). The owner
  //     moving it out keeps ownership.
  //   - A purely personal move (no team on either side) stays owner-
  //     only.
  // Folder existence + scope match is validated before the write so
  // the design never points at a folder outside its scope.
  if (segments.length === 4 && segments[3] === 'folder') {
    const id = segments[2]!;
    if (request.method === 'PUT') {
      const owner = requireOwner(ctx);
      if (owner instanceof Response) return owner;
      const existing = await getDesign(env, id);
      if (!existing) return missingDesign(ctx, id);
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const { folderId: rawFolderId, teamId: rawTeamId } = read;
      if (!isIdOrNull(rawFolderId) || !isIdOrNull(rawTeamId))
        return badRequest('invalid folderId/teamId');
      const folderId = rawFolderId ?? null;
      const teamId = rawTeamId !== undefined ? rawTeamId : existing.teamId;
      // `ownsDesign`, not a bare id compare: a TEAM design's owner id is a
      // account id every teammate can read, and `isOwner` below decides whether
      // the caller may change the design's SCOPE — including moving it out of
      // the team into their own library, which transfers ownership.
      const isOwner = await ownsDesign(ctx, existing);
      const caller = ctx.verifiedUserId;

      if (teamId !== existing.teamId) {
        // Changing scope.
        if (teamId !== null) {
          // Into a team / between teams: joined member of the
          // destination. A personal design can only be filed in by
          // its owner; a team design can be moved by any joined
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
          // current team (it becomes the mover's personal design).
          if (!caller || !existing.teamId) return forbidden();
          const membership = await getMembership(env, existing.teamId, caller);
          if (membership?.status !== 'joined') return forbidden();
        }
      } else if (!isOwner) {
        // Same scope, non-owner: only legal inside a team the caller
        // has joined (re-foldering a teammate's design).
        if (!caller || !existing.teamId) return forbidden();
        const membership = await getMembership(env, existing.teamId, caller);
        if (membership?.status !== 'joined') return forbidden();
      }

      // A non-owner moving a team design out to personal takes
      // ownership (docs/specs/013-workspace/team-shared-designs.md): the design lands in the mover's library.
      const movingOutToPersonal = teamId === null && existing.teamId !== null;
      // Between teams, the same rule keeps the design inside the team that holds it: when its owner is
      // not a joined member of the destination, the mover takes ownership, so nobody outside the team
      // keeps owner access to it (owner access is checked before membership).
      const movingBetweenTeams =
        teamId !== null && existing.teamId !== null && teamId !== existing.teamId;
      const ownerOutsideDestination =
        movingBetweenTeams &&
        !isOwner &&
        (await getMembership(env, teamId, existing.ownerId))?.status !== 'joined';
      const newOwnerId =
        (movingOutToPersonal && !isOwner) || ownerOutsideDestination ? caller! : undefined;
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
      // Resolve the OUTGOING team's audience before the row changes hands: once
      // the design is personal, audienceForDesign returns only its new owner,
      // so the team (and a displaced previous owner) would hear nothing. Same
      // reason the delete path resolves its audience first.
      const leavingAudience = movingOutToPersonal ? await audienceForDesign(env, existing) : null;
      const leftTeam = movingOutToPersonal ? await getTeam(env, existing.teamId!) : null;
      // The folder is re-checked inside the write itself: one deleted since the read above files
      // nothing, and the move answers 404 as if the read had missed it.
      if (!(await setDesignFolder(env, id, folderId, teamId, newOwnerId))) return notFound();
      // docs/specs/013-workspace/timeline.md: publishing into a team library is a different event
      // from filing something in a folder — the first tells a whole
      // team a design is theirs to work on, the second is personal
      // tidying. Re-read the design so the audience resolves against
      // its NEW team, not the one it just left.
      const moved = await getDesign(env, id);
      if (moved) {
        if (teamId !== null && teamId !== existing.teamId) {
          const destination = await getTeam(env, teamId);
          if (destination) {
            ctx.waitUntil?.(recordTeamDesignAdded(env, moved, destination.name, owner));
          }
        } else if (movingOutToPersonal && leavingAudience) {
          // Leaving a team is its own event. It used to fall through to the
          // `design_moved` arm below and read "Moved to a Folder →
          // Unsorted" — in the MOVER's feed only, because the audience
          // resolved against the now-personal design. So a design could
          // leave a shared library and change hands with the team and the
          // previous owner told nothing. Worse, a design sitting at the
          // team-library root already has folderId === null, so
          // `folderId !== existing.folderId` was false and NO event was
          // written at all.
          const newOwner = newOwnerId ? await getParticipant(env, newOwnerId) : null;
          ctx.waitUntil?.(
            recordTeamDesignRemoved(
              env,
              moved,
              leftTeam?.name ?? 'a team',
              owner,
              leavingAudience,
              newOwner?.name ?? null,
            ),
          );
        } else if (folderId !== existing.folderId) {
          // A space's root is no bucket of its own: a move to it names the space
          // (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets).
          const folderName = folderId
            ? ((await getFolder(env, folderId))?.name ?? 'a folder')
            : moved.teamId
              ? ((await getTeam(env, moved.teamId))?.name ?? 'the team')
              : 'My Work';
          ctx.waitUntil?.(recordDesignMoved(env, moved, folderName, owner));
        }
      }
      return noContent();
    }
  }
  return null;
}
