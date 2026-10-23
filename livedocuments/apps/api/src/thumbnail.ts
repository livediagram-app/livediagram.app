// Document SVG snapshot render-cache (docs/specs/006-document/document-snapshots.md). One cached SVG per
// document, stored in R2 (key `thumb/<documentId>`), refreshed lazily on
// read: if the cache is fresh (rendered at or after the document's last
// save) we stream the stored bytes; otherwise we render the first tab
// with the shared DOM-free renderer, write it back, and stamp it fresh.
//
// Two delivery paths share this one artifact (the whole point of the
// design): the owner-authed Explorer thumbnail (GET
// /api/documents/:id/thumbnail) and the public, share-code-scoped live
// image (GET /api/share/:code/image.svg). Rendering on read — rather
// than on every save — means a document nobody looks at never costs a
// render, and every write path (editor, collaborators, MCP, API token)
// invalidates the snapshot uniformly because they all bump saved_at.

import { embedTabImages } from '@livedocuments/api-schema';
import {
  elementsOnPage,
  laidOutPagesOf,
  migrateStoredTab,
  pagesOf,
  renderElementsToSvg,
  renderPageToSvg,
  type Tab,
} from '@livedocuments/document';
// Static-import icon resolver (bundle size is fine in a Worker) so icon
// elements render their real glyph in the snapshot / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@livedocuments/icons/resolve';
import { getTab, getTabBody, thumbnailKey, type StoredTabBody, servableImageIds } from './db';
import { imageRefIds } from './image-refs/extract';
import { mediaClient } from './media';
import { markThumbRendered } from './document-room/document-content';
import { documentRoom } from './document-client';
import type { DocumentDTO, DocumentEnv, Env } from './types';

// Content type for the cached SVG snapshot. Local to this module — the
// HTTP responses set their own header (responses.ts); this only stamps
// the R2 object's metadata on write.
const THUMBNAIL_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

// Ceiling on the raw image bytes inlined into one snapshot. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the cached/streamed SVG by ~1.33×. Without a cap a document full
// of large photos would produce a multi-megabyte thumbnail that's slow to
// cache and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// The document fields a snapshot needs. `thumbRenderedAt` is optional: a
// caller that already read it alongside the document row (the Explorer
// thumbnail route, from the document's own row) passes it and saves a read;
// one that didn't leaves it out and it is read here.
export type ThumbnailSubject = Pick<DocumentDTO, 'id' | 'name' | 'savedAt'> & {
  thumbRenderedAt?: number | null;
};

// `defer` hands the cache write (R2 put + freshness stamp) to a waitUntil, so a stale snapshot's response goes out
// as soon as it is rendered. Without it the write is awaited inline.
export type ThumbnailOptions = { defer?: (write: Promise<unknown>) => void };

// Resolve a document's cached SVG snapshot, rendering + caching it first
// if stale. Returns null — caller should 404 / fall back to an icon —
// when there's nothing to show: no R2 binding (self-host without
// storage), no tab, or an empty / unparseable first tab.
//
// The worker's side: a fresh cache is streamed from R2 without waking the document; a stale one is drawn by the
// document's Durable Object, where the content is (renderDocumentImage), which also writes the cache back.
export async function getDocumentThumbnailSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
): Promise<string | null> {
  // No object store: nothing to cache into or read from. The endpoints
  // 404 and the Explorer row keeps its generic icon, same graceful
  // degradation as the image gallery (docs/specs/009-elements/images.md) on a binding-less deploy.
  if (!env.IMAGES) return null;
  const key = thumbnailKey(liveDoc.id);

  // Fresh = rendered at or after the last save. saved_at follows every content write (the document pushes it,
  // document-room/document-outbox.ts), so any content change makes the snapshot stale.
  const renderedAt =
    liveDoc.thumbRenderedAt !== undefined
      ? liveDoc.thumbRenderedAt
      : ((await documentRoom(env, liveDoc.id).outline()).meta?.thumbRenderedAt ?? null);
  if (renderedAt !== null && renderedAt >= liveDoc.savedAt) {
    const cached = await env.IMAGES.get(key);
    // A present object is the happy path. A miss here means the object
    // was evicted / never written despite the freshness stamp, so we
    // fall through and re-render rather than 404 a document that has
    // content.
    if (cached) return await cached.text();
  }
  return documentRoom(env, liveDoc.id).image(subjectOf(liveDoc), null);
}

// Live image for a SPECIFIC tab (docs/specs/013-workspace/live-image-share.md's per-tab picker, now surfaced
// in the Share dialog). Rendered on read and deliberately NOT written to
// the R2 snapshot cache: `thumb/<documentId>` is the first-tab artifact
// shared with the Explorer thumbnail (docs/specs/006-document/document-snapshots.md) and carries a single
// per-document freshness stamp, so it has no room for a second tab. A
// non-default tab is a niche embed, and the endpoint's short
// stale-while-revalidate Cache-Control keeps repeat views cheap without
// a persistent cache. Returns null (caller 404s) when there's no object
// store, the tab isn't in the document, or the tab is empty / unparseable.
export async function getDocumentTabImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string,
): Promise<string | null> {
  // Gate on the same optional R2 binding as the cached path, so the
  // whole live-image feature is uniformly off on a binding-less deploy.
  if (!env.IMAGES) return null;
  return documentRoom(env, liveDoc.id).image(subjectOf(liveDoc), tabId);
}

// What crosses to the document: plain fields only.
function subjectOf(liveDoc: ThumbnailSubject): ThumbnailSubject {
  return { id: liveDoc.id, name: liveDoc.name, savedAt: liveDoc.savedAt };
}

// The document's side (its Durable Object): draw the first tab and write the cache back, or draw one tab uncached.
// `defer` hands the cache write (R2 put + freshness stamp) to the object's waitUntil, so the image goes out as
// soon as it is drawn.
export async function renderDocumentImage(
  env: DocumentEnv,
  liveDoc: ThumbnailSubject,
  tabId: string | null,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (!env.IMAGES) return null;
  if (tabId) return renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id, tabId));
  const svg = await renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id));
  if (svg == null) return null;

  // Best effort: a write failure (R2 hiccup) must not fail the read —
  // we still return the freshly rendered SVG, just without caching it,
  // so the next read renders again. Only stamp the row as fresh once the
  // object is actually in R2, or a later read would trust a stale/absent
  // object and skip the re-render.
  const images = env.IMAGES;
  const key = thumbnailKey(liveDoc.id);
  const write = (async () => {
    try {
      await images.put(key, svg, { httpMetadata: { contentType: THUMBNAIL_CONTENT_TYPE } });
      await markThumbRendered(env, liveDoc.id, Date.now());
    } catch {
      // Swallow: the SVG is still returned to the caller below.
    }
  })();
  if (opts.defer) opts.defer(write);
  else await write;
  return svg;
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a snapshot it draws an empty tab too, and with no image
// store its images keep their placeholders. Null when the tab is not in the document or its body does not parse.
export async function renderTabSvg(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<string | null> {
  let stored: Awaited<ReturnType<typeof getTab>>;
  try {
    stored = await getTab(env, documentId, tabId);
  } catch (err) {
    console.warn('[render] tab unreadable', { documentId, tabId, error: String(err) });
    return null;
  }
  if (!stored) return null;
  const tab = migrateStoredTab({ ...stored, elements: stored.elements ?? [] });
  const images = await loadEmbeddedImages(env, documentId, tab);
  return renderElementsToSvg(tab, {
    resolveImageHref: (id) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  });
}

// Turn a stored tab body into an SVG, shared by the first-tab snapshot and
// the per-tab live image. Null when the body is
// absent, unparseable, or has nothing to draw (an empty canvas has no
// meaningful thumbnail; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: DocumentEnv,
  liveDoc: ThumbnailSubject,
  body: StoredTabBody | null,
): Promise<string | null> {
  if (!body) return null;
  let parsed: Partial<Tab>;
  try {
    parsed = JSON.parse(body.data) as Partial<Tab>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.elements)) return null;
  if (parsed.elements.length === 0) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  // Settled like every other stored-tab read (docs/specs/011-theme/retired-schemes.md "Where a stored tab is settled").
  const tab = migrateStoredTab({ id: liveDoc.id, name: liveDoc.name, ...parsed } as Tab);
  // A Pages tab previews as its first page alone, drawn as an export draws it
  // (docs/specs/006-document/document-snapshots.md "Pages tabs"): every page side by
  // side on the canvas shrinks to a row of slivers nobody can read at thumbnail size.
  const pages = laidOutPagesOf(tab);
  const firstPage = pages[0];
  // Inline referenced image bitmaps (read from R2) so the preview / live
  // image renders the actual photos, matching the in-app PNG/SVG export.
  // A first-page preview reads only that page's images: its elements' and its picture background.
  const images = await loadEmbeddedImages(
    env,
    liveDoc.id,
    firstPage
      ? {
          ...tab,
          elements: elementsOnPage(tab.elements, pages, firstPage.id),
          // Read as the pages are laid out (pagesOf), so a malformed stored entry is skipped.
          pages: pagesOf(tab).filter((p) => p.id === firstPage.id),
        }
      : tab,
  );
  const drawWith = {
    resolveImageHref: (id: string) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  };
  return firstPage ? renderPageToSvg(tab, firstPage, drawWith) : renderElementsToSvg(tab, drawWith);
}

// Read each image element's bytes from the media service and return them keyed by imageId
// as base64 data URLs, ready for the renderer to inline. The shared embedder
// (@livedocuments/api-schema embedTabImages) reads ids in document order until
// IMAGE_EMBED_BUDGET_BYTES is spent, after which (or on a missing object) the
// element keeps its placeholder. The service is the same store the authenticated image
// endpoint reads (src/media.ts), so a shared document's images embed without
// re-auth, and the same rule decides which: only an image the document may serve
// (docs/specs/009-elements/images.md, "Placement grants") is read, one query for the tab.
async function loadEmbeddedImages(
  env: DocumentEnv,
  documentId: string,
  tab: Tab,
): Promise<Map<string, string>> {
  const media = mediaClient(env);
  if (!media) return new Map();
  // The elements' images and any page's picture background, as embedTabImages reads them.
  const ids = imageRefIds(tab.elements, tab.pages);
  const servable = await servableImageIds(env, documentId, ids);
  if (servable.size < ids.length) {
    console.warn('[images] not servable by document', {
      documentId,
      refused: ids.filter((id) => !servable.has(id)),
    });
  }
  return embedTabImages(
    tab,
    async (id) => {
      if (!servable.has(id)) return null;
      const object = await media.bytes(id);
      if (!object?.body) return null;
      return {
        bytes: await new Response(object.body).arrayBuffer(),
        contentType: object.contentType,
      };
    },
    { totalBudgetBytes: IMAGE_EMBED_BUDGET_BYTES },
  );
}
