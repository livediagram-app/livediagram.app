// A design drawn as an SVG, for its preview (liveworkspace/docs/previews.md): the first tab, or one tab, with the shared
// DOM-free renderer (a Pages tab as its first page), its images inlined and its icons drawn as their glyphs. Drawn in
// the design's Durable Object, where the content is, when liveworkspace's previews service asks the export door
// (design-room.ts `exportImage`); the platform stores it, decides when it is stale and serves it, so nothing here
// caches or writes a picture. Rendering on request means a design nobody looks at never costs a render.

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
// elements render their real glyph in the preview / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import {
  getTab,
  getTabBody,
  stampTabElementCount,
  type StoredTabBody,
  servableImageIds,
} from './db';
import { imageRefIds } from '@liveworkspace/api-kit/image-refs';
import { photoBlobKey, tabHoldsBlobs } from './db/photo-blobs';
import { photosOf } from '@livedesign/photo-engine';
import { mediaClient } from './media';
import type { DesignEnv } from './types';

// Ceiling on the raw image bytes inlined into one drawing. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the SVG by ~1.33×. Without a cap a design full
// of large photos would produce a multi-megabyte preview that is slow to
// store and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// The design fields a drawing needs.
export type DrawSubject = { id: string; name: string };

// `defer` hands the count stamp (below) to a waitUntil, so the drawing goes out as soon as it is drawn.
export type DrawOptions = { defer?: (write: Promise<unknown>) => void };

// The first tab (or `tabId`) drawn, or null when there is nothing to draw: no tab, an empty or unparseable one.
export async function drawDesign(
  env: DesignEnv,
  doc: DrawSubject,
  tabId: string | null,
  opts: DrawOptions = {},
): Promise<string | null> {
  const body = tabId ? await getTabBody(env, doc.id, tabId) : await getTabBody(env, doc.id);
  return renderTabBodyToSvg(env, doc, body, opts);
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a preview it draws an empty tab too, and with no image
// store its images keep their placeholders. Null when the tab is not in the design or its body does not parse.
export async function renderTabSvg(
  env: DesignEnv,
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
// from the parse a drawing does anyway, so the lists know an old empty design after one ask. Best effort:
// a failed stamp leaves the count unknown, which only means the row asks again.
function stampUnknownCount(
  env: DesignEnv,
  body: StoredTabBody,
  count: number,
  opts: DrawOptions,
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

// Turn a stored tab body into an SVG, for the first tab or one tab. Null when the body is absent, unparseable, or has
// nothing to draw (an empty canvas has no meaningful preview; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: DesignEnv,
  liveDoc: DrawSubject,
  body: StoredTabBody | null,
  opts: DrawOptions = {},
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
  // Inline referenced image bitmaps (from the media service) so the preview / live
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
// the drawing's embed budget; a missing one leaves the page's checkerboard.
async function loadPhotoPreviews(
  env: DesignEnv,
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

// Read each image element's bytes from the media service and return them keyed by imageId
// as base64 data URLs, ready for the renderer to inline. The shared embedder
// (@livedesign/api-schema embedTabImages) reads ids in document order until
// IMAGE_EMBED_BUDGET_BYTES is spent, after which (or on a missing object) the
// element keeps its placeholder. The service is the same store the authenticated image
// endpoint reads (src/media.ts), so a shared design's images embed without
// re-auth, and the same rule decides which: only an image the design may serve
// (docs/specs/009-elements/images.md, "Placement grants") is read, one query for the tab.
async function loadEmbeddedImages(
  env: DesignEnv,
  designId: string,
  tab: Tab,
): Promise<Map<string, string>> {
  const media = mediaClient(env);
  if (!media) return new Map();
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
