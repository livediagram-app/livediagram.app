// DELETE /api/designs/<id> (docs/specs/013-workspace/trash.md): a delete moves
// the design to the Trash. `?permanent=true` deletes it for good, and the
// owner's Take Offline bypasses the Trash (docs/specs/006-design/offline-mode.md):
// it is a move into their browser, not a delete.

import { DESIGN_CONVERSION_HEADER, readDesignConversion } from '@livedesign/api-schema';
import {
  deleteDesign,
  getDesign,
  getTrashedDesignMeta,
  purgeDesigns,
  trashDesign,
} from '../db';
import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { designTrashed, forbidden, noContent, notFound } from '../responses';
import { broadcastDesignTrashed } from '../room-client';
import { recordDesignOffline } from '../timeline';
import { mayDeleteDesign, requireOwner, type RouteContext } from './context';

export async function handleDesignDelete(ctx: RouteContext, id: string): Promise<Response> {
  const { env, request, url } = ctx;
  // Owner or joined teammate, never a share-link visitor (mayDeleteDesign).
  // Resolve the caller first (400 with no auth), then 404 on a missing
  // design (no existence leak), then 403 on a caller with no claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const permanent = url.searchParams.get('permanent') === 'true';

  const existing = await getDesign(env, id);
  if (!existing) return deleteFromTrash(ctx, id, permanent);
  if (!(await mayDeleteDesign(ctx, existing))) return forbidden();

  // Take Offline is honoured for the OWNER only. The DELETE is also reachable
  // by any joined member of the design's team, and when a teammate takes a
  // team design offline it leaves the owner's account and the team for good:
  // from their side that is a deletion, so it goes to the team Trash.
  const conversion =
    owner === existing.ownerId
      ? readDesignConversion(request.headers.get(DESIGN_CONVERSION_HEADER))
      : null;
  if (conversion === 'offline') {
    // docs/specs/013-workspace/timeline.md §3.5: the server copy leaves no trace
    // on the Timeline, and the move itself earns an owner-only card.
    await deleteDesign(env, id);
    ctx.waitUntil?.(
      markTimelineEventsDeletedBySource(env, 'design', id)
        .then(() => recordDesignOffline(env, existing, owner))
        .catch((err) => console.error('timeline design delete failed', err)),
    );
    console.info('[trash] bypassed for take offline', id);
    return noContent();
  }

  await trashDesign(env, id, Date.now());
  // Open sessions end now, with the deleted state; later joins are refused
  // because the room's admission reads live designs only.
  ctx.waitUntil?.(broadcastDesignTrashed(env, existing.id));
  if (permanent) {
    await purgeDesigns(env, [id]);
    console.info('[trash] deleted permanently', id);
  } else {
    console.info('[trash] trashed', id);
  }
  return noContent();
}

// The DELETE of an id with no live design: in the Trash, `permanent` purges
// it and a plain delete answers the deleted state. A stranger (or a
// share-link visitor, who may never delete) gets the 404 of a missing id.
async function deleteFromTrash(
  ctx: RouteContext,
  id: string,
  permanent: boolean,
): Promise<Response> {
  const binned = await getTrashedDesignMeta(ctx.env, id);
  if (!binned || !(await mayDeleteDesign(ctx, binned))) return notFound();
  if (!permanent) return designTrashed();
  await purgeDesigns(ctx.env, [id]);
  console.info('[trash] purged from the Trash', id);
  return noContent();
}
