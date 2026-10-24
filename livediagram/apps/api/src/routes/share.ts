// /api/share/<code>: what a share link opens (docs/specs/013-workspace/share-roles.md), as the index resolves it. What
// a link shows without opening (its live image, its share card and the name a link preview reads) is liveworkspace's
// (liveworkspace/docs/previews.md): the router sends `/api/share/<code>/image.svg|image.png|card` there, and the
// canvas only draws (routes/internal-items.ts, the export door).

import { documentRoom } from '../document-client';
import { json, notFound } from '../responses';
import type { RouteContext } from './context';
import { handleDocuments } from './documents';
import { clientFor, refusal } from './index-adapters';

export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  const code = segments[2];
  if (!code) return notFound();
  if (segments.length !== 3 || request.method !== 'GET') return notFound();
  return resolveLink(ctx, code);
}

// GET /api/share/<code> {document, role, tabId, community?}: the canvas a visitor landing on /document/shared?s=<code>
// opens, read as that link opens it (redacted for the reader, confined to the link's tab). The index resolves the
// code: an unknown, revoked or expired one is 404, a canvas in the Trash says so, and a share password answers 401
// (none sent, X-Share-Password) or 403 (a wrong one). The index records the visit for the visitor's Shared and tells
// the owner of a first one (routes/internal-items.ts `joined`). A Community post's link (docs/specs/025-community/
// community.md "Viewing a post's document") is read-only for everyone and carries the post; while the post is not
// public it answers 404 and nothing else.
async function resolveLink(ctx: RouteContext, code: string): Promise<Response> {
  const { request, env } = ctx;
  const client = clientFor(ctx);
  if (client instanceof Response) return client;
  let resolved: { id: string; level: string; tabId: string | null };
  try {
    const password = request.headers.get('X-Share-Password');
    const { item, level, tabId } = await client.resolveShare(code, password);
    resolved = { id: item.id, level, tabId };
  } catch (err) {
    return refusal(err);
  }
  const room = documentRoom(env, resolved.id);
  const post = await room.community();
  const isCommunity = post !== null && post.code === code;
  if (isCommunity && !post.open) return notFound();
  // The canvas as the link opens it: the document read, through the link, answered by the canvas itself.
  const url = new URL(`/api/documents/${encodeURIComponent(resolved.id)}`, request.url);
  const headers = new Headers(request.headers);
  headers.set('X-Share-Code', code);
  const read = await handleDocuments({
    ...ctx,
    request: new Request(url, { method: 'GET', headers }),
    url,
    segments: ['api', 'documents', resolved.id],
  });
  if (!read.ok) return read;
  const { document } = (await read.json()) as { document: unknown };
  const community = isCommunity ? await room.communityListing(code) : null;
  if (isCommunity && !community) return notFound();
  return json({
    document,
    role: isCommunity ? 'view' : resolved.level,
    tabId: isCommunity ? null : resolved.tabId,
    ...(community ? { community } : {}),
  });
}
