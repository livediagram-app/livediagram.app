// The Trash (own and every joined team's), for API clients (index-adapters.ts).

import { trashPurgeDueAt, type TrashedDocument } from '@livediagram/api-schema';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import { INDEX_APP } from '../index-service';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { allPages, clientFor, refusal } from './index-adapters';

// GET /api/trash, DELETE /api/trash[?team=<id>] (empty the personal Trash, or one joined team's, of canvases),
// POST /api/trash/:id/restore, DELETE /api/trash/:id.
export async function handleTrash(ctx: RouteContext): Promise<Response> {
  const { request, segments, url } = ctx;
  const id = segments[2];
  const isList = segments.length === 2 && request.method === 'GET';
  const isEmpty = segments.length === 2 && request.method === 'DELETE';
  const isRestore =
    !!id && segments.length === 4 && segments[3] === 'restore' && request.method === 'POST';
  const isPurge = !!id && segments.length === 3 && request.method === 'DELETE';
  if (!isList && !isEmpty && !isRestore && !isPurge) return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  const names = new Map((ctx.teams ?? []).map((t) => [t.id, t.name]));
  // A team the caller has not joined reads as missing, as it always has.
  const team = isEmpty ? url.searchParams.get('team') : null;
  if (team !== null && !names.has(team)) return notFound();
  try {
    if (isEmpty) {
      // Canvases only: the index empties livediagram's items in the scope, never another app's.
      const { purged } = await client.emptyTrash({ app: INDEX_APP, ...(team ? { team } : {}) });
      console.info('[trash] emptied', team !== null ? 'team' : 'personal', purged);
      return json({ purged });
    }
    if (isList) {
      const items = await allPages((cursor) =>
        client
          .listTrash({ app: INDEX_APP, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
          .then((p) => ({ list: p.items, nextCursor: p.nextCursor })),
      );
      const trash: TrashedDocument[] = items.map((item) => {
        const trashedAt = item.trashedAt ?? item.updatedAt;
        return {
          id: item.id,
          name: item.title,
          teamId: item.teamId,
          teamName: item.teamId ? (names.get(item.teamId) ?? null) : null,
          trashedAt,
          purgeAt: trashPurgeDueAt(trashedAt),
          reason: item.trashReason ?? 'deleted',
        };
      });
      return json({ trash });
    }
    if (isRestore) {
      const { item } = await client.restoreItem(id);
      return json({ document: { id: item.id, name: item.title } });
    }
    await client.deleteItem(id!, { permanent: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return refusal(err);
  }
}
