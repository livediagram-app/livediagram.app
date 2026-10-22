// DELETE /api/projects/<id> (docs/specs/013-workspace/trash.md): a delete moves
// the project to the Trash. `?permanent=true` deletes it for good, and the
// owner's Take Offline bypasses the Trash (docs/specs/006-project/offline-mode.md):
// it is a move into their browser, not a delete.

import { PROJECT_CONVERSION_HEADER, readProjectConversion } from '@liveplanner/api-schema';
import {
  deleteProject,
  getProject,
  getTrashedProjectMeta,
  purgeProjects,
  trashProject,
} from '../db';
import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { projectTrashed, forbidden, noContent, notFound } from '../responses';
import { broadcastProjectTrashed } from '../room-client';
import { recordProjectOffline } from '../timeline';
import { mayDeleteProject, requireOwner, type RouteContext } from './context';

export async function handleProjectDelete(ctx: RouteContext, id: string): Promise<Response> {
  const { env, request, url } = ctx;
  // Owner or joined teammate, never a share-link visitor (mayDeleteProject).
  // Resolve the caller first (400 with no auth), then 404 on a missing
  // project (no existence leak), then 403 on a caller with no claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const permanent = url.searchParams.get('permanent') === 'true';

  const existing = await getProject(env, id);
  if (!existing) return deleteFromTrash(ctx, id, permanent);
  if (!(await mayDeleteProject(ctx, existing))) return forbidden();

  // Take Offline is honoured for the OWNER only. The DELETE is also reachable
  // by any joined member of the project's team, and when a teammate takes a
  // team project offline it leaves the owner's account and the team for good:
  // from their side that is a deletion, so it goes to the team Trash.
  const conversion =
    owner === existing.ownerId
      ? readProjectConversion(request.headers.get(PROJECT_CONVERSION_HEADER))
      : null;
  if (conversion === 'offline') {
    // docs/specs/013-workspace/timeline.md §3.5: the server copy leaves no trace
    // on the Timeline, and the move itself earns an owner-only card.
    await deleteProject(env, id);
    ctx.waitUntil?.(
      markTimelineEventsDeletedBySource(env, 'project', id)
        .then(() => recordProjectOffline(env, existing, owner))
        .catch((err) => console.error('timeline project delete failed', err)),
    );
    console.info('[trash] bypassed for take offline', id);
    return noContent();
  }

  await trashProject(env, id, Date.now());
  // Open sessions end now, with the deleted state; later joins are refused
  // because the room's admission reads live projects only.
  ctx.waitUntil?.(broadcastProjectTrashed(env, existing.id));
  if (permanent) {
    await purgeProjects(env, [id]);
    console.info('[trash] deleted permanently', id);
  } else {
    console.info('[trash] trashed', id);
  }
  return noContent();
}

// The DELETE of an id with no live project: in the Trash, `permanent` purges
// it and a plain delete answers the deleted state. A stranger (or a
// share-link visitor, who may never delete) gets the 404 of a missing id.
async function deleteFromTrash(
  ctx: RouteContext,
  id: string,
  permanent: boolean,
): Promise<Response> {
  const binned = await getTrashedProjectMeta(ctx.env, id);
  if (!binned || !(await mayDeleteProject(ctx, binned))) return notFound();
  if (!permanent) return projectTrashed();
  await purgeProjects(ctx.env, [id]);
  console.info('[trash] purged from the Trash', id);
  return noContent();
}
