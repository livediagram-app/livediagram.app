// The Trash (own and every joined team's), for API clients (index-adapters.ts).

import { trashPurgeDueAt, type TrashedDesign } from '@livedesign/api-schema';
import { LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import { INDEX_APP } from '../index-service';
import { json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { allPages, clientFor, refusal } from './index-adapters';

// GET /api/trash, POST /api/trash/:id/restore, DELETE /api/trash/:id.
export async function handleTrash(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  const id = segments[2];
  const isList = segments.length === 2 && request.method === 'GET';
  const isRestore =
    !!id && segments.length === 4 && segments[3] === 'restore' && request.method === 'POST';
  const isPurge = !!id && segments.length === 3 && request.method === 'DELETE';
  if (!isList && !isRestore && !isPurge) return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  const names = new Map((ctx.teams ?? []).map((t) => [t.id, t.name]));
  try {
    if (isList) {
      const items = await allPages((cursor) =>
        client
          .listTrash({ app: INDEX_APP, limit: LIST_LIMIT_MAX, ...(cursor ? { cursor } : {}) })
          .then((p) => ({ list: p.items, nextCursor: p.nextCursor })),
      );
      const trash: TrashedDesign[] = items.map((item) => {
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
      return json({ design: { id: item.id, name: item.title } });
    }
    await client.deleteItem(id!, { permanent: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return refusal(err);
  }
}
