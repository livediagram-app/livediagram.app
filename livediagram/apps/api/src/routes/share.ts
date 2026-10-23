// /api/share/<code>: what a share link opens (docs/specs/013-workspace/share-roles.md), as the index resolves it,
// and what it shows without opening: the live image (docs/specs/013-workspace/live-image-share.md) and the link
// preview's doors (share-preview.ts).

import { documentImageSvg } from '../document-image';
import { documentRoom } from '../document-client';
import { json, notFound, svgImage } from '../responses';
import type { RouteContext } from './context';
import { handleDocuments } from './documents';
import { clientFor, refusal } from './index-adapters';
import { handleSharePreview, previewSubject } from './share-preview';

// Short, stale-while-revalidate cache so embeds stay close to live without hammering the origin on every view (the
// bytes themselves come from R2; the canvas re-renders only when it was saved since).
const SHARE_IMAGE_CACHE = 'public, max-age=30, stale-while-revalidate=300';
// A Community post's image has no stale window, so it cannot linger once the post is hidden.
const COMMUNITY_IMAGE_CACHE = 'public, max-age=30';

export async function handleShare(ctx: RouteContext): Promise<Response> {
  const { request, segments } = ctx;
  const code = segments[2];
  if (!code) return notFound();
  if (segments.length === 4 && segments[3] === 'image.svg' && request.method === 'GET') {
    return shareImage(ctx, code);
  }
  // /api/share/<code>/card and /image.png: what a link preview reads (docs/specs/013-workspace/share-link-previews.md).
  const preview = await handleSharePreview(ctx);
  if (preview) return preview;
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

// The live image: the canvas's cached SVG snapshot, served public-by-share-code so a bare <img> in a README, wiki or
// Notion page can embed it with no auth header. 404 on an unknown, revoked or expired code, a canvas in the Trash, a
// canvas behind a share password (an <img> can't supply it: the Share dialog hides the live image while one is set,
// and this is the server's side of that), a Community post that is not public, and an empty canvas. `?tab=<id>`
// picks a tab; a tab-scoped link always renders its own, and any other tab is a 404 before rendering.
async function shareImage(ctx: RouteContext, code: string): Promise<Response> {
  const subject = await previewSubject(ctx.env, code);
  if (!subject) return notFound();
  const asked = ctx.url.searchParams.get('tab');
  if (subject.tabId !== null && asked !== null && asked !== subject.tabId) return notFound();
  const tabId = subject.tabId ?? asked;
  const svg = await documentImageSvg(ctx.env, subject.doc, {
    tabId,
    community: subject.community,
  });
  return svg == null
    ? notFound()
    : svgImage(svg, subject.community ? COMMUNITY_IMAGE_CACHE : SHARE_IMAGE_CACHE);
}
