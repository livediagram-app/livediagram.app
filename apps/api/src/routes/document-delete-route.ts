// DELETE /api/diagrams/<id> (docs/specs/013-workspace/trash.md): a delete moves
// the diagram to the Trash. `?permanent=true` deletes it for good, and the
// owner's Take Offline bypasses the Trash (docs/specs/006-document/offline-mode.md):
// it is a move into their browser, not a delete.

import { DOCUMENT_CONVERSION_HEADER, readDocumentConversion } from '@livediagram/api-schema';
import {
  deleteDocument,
  getDocument,
  getTrashedDocumentMeta,
  purgeDocuments,
  trashDocument,
} from '../db';
import { markTimelineEventsDeletedBySource } from '../db/timeline';
import { documentTrashed, forbidden, noContent, notFound } from '../responses';
import { broadcastDocumentTrashed } from '../room-client';
import { recordDocumentOffline } from '../timeline';
import { mayDeleteDocument, requireOwner, type RouteContext } from './context';

export async function handleDocumentDelete(ctx: RouteContext, id: string): Promise<Response> {
  const { env, request, url } = ctx;
  // Owner or joined teammate, never a share-link visitor (mayDeleteDiagram).
  // Resolve the caller first (400 with no auth), then 404 on a missing
  // diagram (no existence leak), then 403 on a caller with no claim.
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const permanent = url.searchParams.get('permanent') === 'true';

  const existing = await getDocument(env, id);
  if (!existing) return deleteFromTrash(ctx, id, permanent);
  if (!(await mayDeleteDocument(ctx, existing))) return forbidden();

  // Take Offline is honoured for the OWNER only. The DELETE is also reachable
  // by any joined member of the diagram's team, and when a teammate takes a
  // team diagram offline it leaves the owner's account and the team for good:
  // from their side that is a deletion, so it goes to the team Trash.
  const conversion =
    owner === existing.ownerId
      ? readDocumentConversion(request.headers.get(DOCUMENT_CONVERSION_HEADER))
      : null;
  if (conversion === 'offline') {
    // docs/specs/013-workspace/timeline.md §3.5: the server copy leaves no trace
    // on the Timeline, and the move itself earns an owner-only card.
    await deleteDocument(env, id);
    ctx.waitUntil?.(
      markTimelineEventsDeletedBySource(env, 'document', id)
        .then(() => recordDocumentOffline(env, existing, owner))
        .catch((err) => console.error('timeline diagram delete failed', err)),
    );
    console.info('[trash] bypassed for take offline', id);
    return noContent();
  }

  await trashDocument(env, id, Date.now());
  // Open sessions end now, with the deleted state; later joins are refused
  // because the room's admission reads live diagrams only.
  ctx.waitUntil?.(broadcastDocumentTrashed(env, existing));
  if (permanent) {
    await purgeDocuments(env, [id]);
    console.info('[trash] deleted permanently', id);
  } else {
    console.info('[trash] trashed', id);
  }
  return noContent();
}

// The DELETE of an id with no live diagram: in the Trash, `permanent` purges
// it and a plain delete answers the deleted state. A stranger (or a
// share-link visitor, who may never delete) gets the 404 of a missing id.
async function deleteFromTrash(
  ctx: RouteContext,
  id: string,
  permanent: boolean,
): Promise<Response> {
  const binned = await getTrashedDocumentMeta(ctx.env, id);
  if (!binned || !(await mayDeleteDocument(ctx, binned))) return notFound();
  if (!permanent) return documentTrashed();
  await purgeDocuments(ctx.env, [id]);
  console.info('[trash] purged from the Trash', id);
  return noContent();
}
