// What a share link opens, for API clients and the editor (index-adapters.ts). What it shows without opening (its
// live image and preview card) is liveworkspace's (liveworkspace/docs/specs/006-media/previews.md): the router sends
// `/api/share/<code>/image.svg|image.png|card` there, and the service asks the export door (routes/internal-items.ts)
// for the drawing.

import { documentRoom } from '../document-client';
import { notFound, json } from '../responses';
import type { RouteContext } from './context';
import { clientFor, refusal } from './index-adapters';

// GET /api/share/:code {document, role, tabId, community?}. A Community post's link (docs/specs/025-community/
// community.md "Viewing a post's document") is read-only for everyone, covers every tab and carries the post (its id
// and who it shows as author); while the post is not public it answers 404 and nothing else.
export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, segments, env } = ctx;
  const code = segments[2];
  if (!code || segments.length !== 3 || request.method !== 'GET') return notFound();
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  let resolved: { id: string; name: string; level: string; tabId: string | null };
  try {
    const password = request.headers.get('X-Share-Password');
    const { item, level, tabId } = await client.resolveShare(code, password);
    resolved = { id: item.id, name: item.title, level, tabId };
  } catch (err) {
    return refusal(err);
  }
  const room = documentRoom(env, resolved.id);
  const post = await room.community();
  const isCommunity = post !== null && post.code === code;
  const community = isCommunity && post.open ? await room.communityListing(code) : null;
  if (isCommunity && !community) return notFound();
  return json({
    document: { id: resolved.id, name: resolved.name },
    role: isCommunity ? 'view' : resolved.level,
    tabId: isCommunity ? null : resolved.tabId,
    ...(community ? { community } : {}),
  });
}
