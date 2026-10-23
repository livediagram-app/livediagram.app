// Design SVG snapshot render-cache (docs/specs/006-design/design-snapshots.md). One cached SVG per
// design, stored in R2 (key `thumb/<designId>`), refreshed lazily on
// read: if the cache is fresh (rendered at or after the design's last
// save) we stream the stored bytes; otherwise we render the first tab
// with the shared DOM-free renderer, write it back, and stamp it fresh.
//
// Two delivery paths share this one artifact (the whole point of the
// design): the owner-authed Explorer thumbnail (GET
// /api/designs/:id/thumbnail) and the public, share-code-scoped live
// image (GET /api/share/:code/image.svg). Rendering on read — rather
// than on every save — means a design nobody looks at never costs a
// render, and every write path (editor, collaborators, MCP, API token)
// invalidates the snapshot uniformly because they all bump saved_at.

import { embedTabImages } from '@livedesign/api-schema';
import {
  drawnCount,
  elementsOnPage,
  laidOutPagesOf,
  migrateStoredTab,
  pagesOf,
  renderElementsToSvg,
  renderPageToSvg,
  type Tab,
} from '@livedesign/design';
// Static-import icon resolver (bundle size is fine in a Worker) so icon
// elements render their real glyph in the snapshot / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@livedesign/icons/resolve';
import {
  getTab,
  getTabBody,
  getThumbRenderedAt,
  markThumbRendered,
  stampTabElementCount,
  thumbnailKey,
  type StoredTabBody,
  servableImageIds,
} from './db';
import { imageRefIds } from './image-refs/extract';
import { photoBlobKey, tabHoldsBlobs } from './db/photo-blobs';
import { photosOf } from '@livedesign/photo-engine';
import type { DesignDTO, Env } from './types';

// Content type for the cached SVG snapshot. Local to this module — the
// HTTP responses set their own header (responses.ts); this only stamps
// the R2 object's metadata on write.
const THUMBNAIL_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

// Ceiling on the raw image bytes inlined into one snapshot. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the cached/streamed SVG by ~1.33×. Without a cap a design full
// of large photos would produce a multi-megabyte thumbnail that's slow to
// cache and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// The design fields a snapshot needs. `thumbRenderedAt` is optional: a
// caller that already read it alongside the design row (the Explorer
// thumbnail route, via getDesignThumbMeta) passes it and saves a query;
// one that didn't leaves it out and it is read here.
export type ThumbnailSubject = Pick<DesignDTO, 'id' | 'name' | 'savedAt'> & {
  thumbRenderedAt?: number | null;
};

// `defer` hands the cache write (R2 put + freshness stamp) to the
// request's waitUntil, so a stale snapshot's response goes out as soon as
// it is rendered instead of after two more round trips. Without it the
// write is awaited inline, as before.
export type ThumbnailOptions = { defer?: (write: Promise<unknown>) => void };

// Resolve a design's cached SVG snapshot, rendering + caching it first
// if stale. Returns null — caller should 404 / fall back to an icon —
// when there's nothing to show: no R2 binding (self-host without
// storage), no tab, or an empty / unparseable first tab.
export async function getDesignThumbnailSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  // No object store: nothing to cache into or read from. The endpoints
  // 404 and the Explorer row keeps its generic icon, same graceful
  // degradation as the image gallery (docs/specs/009-elements/images.md) on a binding-less deploy.
  if (!env.IMAGES) return null;
  const key = thumbnailKey(liveDoc.id);

  // Fresh = rendered at or after the last save. saved_at is bumped by
  // every tab write, so any content change makes the snapshot stale.
  const renderedAt =
    liveDoc.thumbRenderedAt !== undefined
      ? liveDoc.thumbRenderedAt
      : await getThumbRenderedAt(env, liveDoc.id);
  if (renderedAt !== null && renderedAt >= liveDoc.savedAt) {
    const cached = await env.IMAGES.get(key);
    // A present object is the happy path. A miss here means the object
    // was evicted / never written despite the freshness stamp, so we
    // fall through and re-render rather than 404 a design that has
    // content.
    if (cached) return await cached.text();
  }

  const svg = await renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id), opts);
  if (svg == null) return null;

  // Best effort: a write failure (R2 hiccup) must not fail the read —
  // we still return the freshly rendered SVG, just without caching it,
  // so the next read renders again. Only stamp the row as fresh once the
  // object is actually in R2, or a later read would trust a stale/absent
  // object and skip the re-render.
  const images = env.IMAGES;
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

// Live image for a SPECIFIC tab (docs/specs/013-workspace/live-image-share.md's per-tab picker, now surfaced
// in the Share dialog). Rendered on read and deliberately NOT written to
// the R2 snapshot cache: `thumb/<designId>` is the first-tab artifact
// shared with the Explorer thumbnail (docs/specs/006-design/design-snapshots.md) and carries a single
// per-design freshness stamp, so it has no room for a second tab. A
// non-default tab is a niche embed, and the endpoint's short
// stale-while-revalidate Cache-Control keeps repeat views cheap without
// a persistent cache. Returns null (caller 404s) when there's no object
// store, the tab isn't in the design, or the tab is empty / unparseable.
export async function getDesignTabImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string,
): Promise<string | null> {
  // Gate on the same optional R2 binding as the cached path, so the
  // whole live-image feature is uniformly off on a binding-less deploy.
  if (!env.IMAGES) return null;
  return renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id, tabId));
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a snapshot it draws an empty tab too, and with no image
// store its images keep their placeholders. Null when the tab is not in the design or its body does not parse.
export async function renderTabSvg(
  env: Env,
  designId: string,
  tabId: string,
): Promise<string | null> {
  let stored: Awaited<ReturnType<typeof getTab>>;
  try {
    stored = await getTab(env, designId, tabId);
  } catch (err) {
    console.warn('[render] tab unreadable', { designId, tabId, error: String(err) });
    return null;
  }
  if (!stored) return null;
  const tab = migrateStoredTab({ ...stored, elements: stored.elements ?? [] });
  const images = await loadEmbeddedImages(env, designId, tab);
  return renderElementsToSvg(tab, {
    resolveImageHref: (id) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  });
}

// The lazy backfill of tabs.element_count (the baseline migration): a tab stored before the count existed gets it
// from the parse a render does anyway, so the lists know an old empty design after one ask. Best effort:
// a failed stamp leaves the count unknown, which only means the row asks again.
function stampUnknownCount(
  env: Env,
  body: StoredTabBody,
  count: number,
  opts: ThumbnailOptions,
): Promise<void> | undefined {
  if (body.elementCount !== null) return undefined;
  const stamp = stampTabElementCount(env, body.id, count).catch((error: unknown) => {
    console.warn('[thumbnail] count stamp failed', { tabId: body.id, error: String(error) });
  });
  if (opts.defer) {
    opts.defer(stamp);
    return undefined;
  }
  return stamp;
}

// Turn a stored tab body into an SVG, shared by the first-tab snapshot and
// the per-tab live image. Null when the body is
// absent, unparseable, or has nothing to draw (an empty canvas has no
// meaningful thumbnail; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  body: StoredTabBody | null,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (!body) return null;
  let parsed: Partial<Tab>;
  try {
    parsed = JSON.parse(body.data) as Partial<Tab>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.elements)) return null;
  await stampUnknownCount(env, body, drawnCount(parsed), opts);
  if (parsed.elements.length === 0) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  // Migrated like every other stored-tab read (docs/specs/011-theme/retired-schemes.md).
  const tab = migrateStoredTab({ id: liveDoc.id, name: liveDoc.name, ...parsed } as Tab);
  // A Pages tab previews as its first page alone, drawn as an export draws it
  // (docs/specs/006-design/design-snapshots.md "Pages tabs"): every page side by
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
  // A photo page draws its preview (docs/specs/031-photo/photo-store.md "Previews").
  const photoPreviews =
    firstPage?.kind === 'photo'
      ? await loadPhotoPreviews(env, tab, [firstPage.id])
      : new Map<string, string>();
  const drawWith = {
    resolvePhotoHref: (pageId: string) => photoPreviews.get(pageId),
    resolveImageHref: (id: string) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  };
  return firstPage ? renderPageToSvg(tab, firstPage, drawWith) : renderElementsToSvg(tab, drawWith);
}

// A photo page's preview (a flattened copy, docs/specs/031-photo/photo-store.md "Previews") as a data
// URL by page id, for the pages asked for: read from R2 only when the tab holds a ref to it, within
// the snapshot's embed budget; a missing one leaves the page's checkerboard.
async function loadPhotoPreviews(
  env: Env,
  tab: Tab,
  pageIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!env.PHOTO_BLOBS) return out;
  const photos = photosOf(tab);
  const wanted = pageIds
    .map((id) => [id, photos[id]?.preview] as const)
    .filter((e): e is readonly [string, string] => typeof e[1] === 'string');
  if (wanted.length === 0) return out;
  const held = await tabHoldsBlobs(
    env,
    tab.id,
    wanted.map(([, blob]) => blob),
  );
  let budget = IMAGE_EMBED_BUDGET_BYTES;
  for (const [pageId, blob] of wanted) {
    if (!held.has(blob)) continue;
    const object = await env.PHOTO_BLOBS.get(photoBlobKey(blob));
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.length > budget) continue;
    budget -= bytes.length;
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out.set(pageId, `data:${object.httpMetadata?.contentType ?? 'image/webp'};base64,${btoa(bin)}`);
  }
  return out;
}

// Read each image element's bytes from R2 and return them keyed by imageId
// as base64 data URLs, ready for the renderer to inline. The shared embedder
// (@livedesign/api-schema embedTabImages) reads ids in document order until
// IMAGE_EMBED_BUDGET_BYTES is spent, after which (or on a missing object) the
// element keeps its placeholder. R2 is the same store the authenticated image
// endpoint reads (key = imageId), so a shared design's images embed without
// re-auth, and the same rule decides which: only an image the design may serve
// (docs/specs/009-elements/images.md, "Placement grants") is read, one query for the tab.
async function loadEmbeddedImages(
  env: Env,
  designId: string,
  tab: Tab,
): Promise<Map<string, string>> {
  const images = env.IMAGES;
  if (!images) return new Map();
  // The elements' images and any page's picture background, as embedTabImages reads them.
  const ids = imageRefIds(tab.elements, tab.pages);
  const servable = await servableImageIds(env, designId, ids);
  if (servable.size < ids.length) {
    console.warn('[images] not servable by design', {
      designId,
      refused: ids.filter((id) => !servable.has(id)),
    });
  }
  return embedTabImages(
    tab,
    async (id) => {
      if (!servable.has(id)) return null;
      const object = await images.get(id);
      if (!object) return null;
      return {
        bytes: await object.arrayBuffer(),
        contentType: object.httpMetadata?.contentType ?? null,
      };
    },
    { totalBudgetBytes: IMAGE_EMBED_BUDGET_BYTES },
  );
}
