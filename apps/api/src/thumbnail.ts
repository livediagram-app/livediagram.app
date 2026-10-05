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

import { embedTabImages } from '@livediagram/api-schema';
import { migrateStoredTab, renderElementsToSvg, type Tab } from '@livediagram/document';
import { typesOf } from '@livediagram/items';
// Static-import icon resolver (bundle size is fine in a Worker) so icon
// elements render their real glyph in the snapshot / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@livediagram/icons/resolve';
import {
  getTab,
  getTabBody,
  getThumbRenderedAt,
  markThumbRendered,
  stampTabElementCount,
  thumbnailKey,
  type StoredTabBody,
  listItems,
} from './db';
import type { DocumentDTO, Env } from './types';

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
// thumbnail route, via getDocumentThumbMeta) passes it and saves a query;
// one that didn't leaves it out and it is read here.
export type ThumbnailSubject = Pick<DocumentDTO, 'id' | 'name' | 'savedAt' | 'itemTypes'> & {
  thumbRenderedAt?: number | null;
};

// `defer` hands the cache write (R2 put + freshness stamp) to the
// request's waitUntil, so a stale snapshot's response goes out as soon as
// it is rendered instead of after two more round trips. Without it the
// write is awaited inline, as before.
export type ThumbnailOptions = { defer?: (write: Promise<unknown>) => void };

// Resolve a document's cached SVG snapshot, rendering + caching it first
// if stale. Returns null — caller should 404 / fall back to an icon —
// when there's nothing to show: no R2 binding (self-host without
// storage), no tab, or an empty / unparseable first tab.
export async function getDocumentThumbnailSvg(
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
    // fall through and re-render rather than 404 a document that has
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
  return renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id, tabId));
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a snapshot it draws an empty tab too, and with no image
// store its images keep their placeholders. Null when the tab is not in the document or its body does not parse.
export async function renderTabSvg(
  env: Env,
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
  const tab = migrateStoredTab({ ...stored, elements: stored.elements ?? [] } as Tab);
  const images = await loadEmbeddedImages(env, tab);
  return renderElementsToSvg(tab, {
    resolveImageHref: (id) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  });
}

// The lazy backfill of tabs.element_count (migration 0059): a tab stored before the count existed gets it
// from the parse a render does anyway, so the lists know an old empty document after one ask. Best effort:
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
// the per-tab live image. Null when the body is absent, unparseable, or
// has no elements (an empty canvas has no meaningful thumbnail; the row
// shows its icon instead).
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
  await stampUnknownCount(env, body, parsed.elements.length, opts);
  if (parsed.elements.length === 0) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  // Migrated like every other stored-tab read (docs/specs/011-theme/retired-schemes.md).
  const tab = migrateStoredTab({ id: liveDoc.id, name: liveDoc.name, ...parsed } as Tab);
  // Inline referenced image bitmaps (read from R2) so the preview / live
  // image renders the actual photos, matching the in-app PNG/SVG export.
  const images = await loadEmbeddedImages(env, tab);
  // A Plan board or card draws its document's items (docs/specs/025-plan/plan-board.md).
  const plan = tab.elements.some(
    (el) => el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card'),
  );
  const items = plan
    ? new Map((await listItems(env, liveDoc.id)).map((i) => [i.id, i]))
    : undefined;
  return renderElementsToSvg(tab, {
    resolveImageHref: (id) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
    items,
    // Custom types keep their colours (docs/specs/025-plan/item-types.md).
    itemTypes: plan ? typesOf(liveDoc.itemTypes) : undefined,
  });
}

// Read each image element's bytes from R2 and return them keyed by imageId
// as base64 data URLs, ready for the renderer to inline. The shared embedder
// (@livediagram/api-schema embedTabImages) reads ids in document order until
// IMAGE_EMBED_BUDGET_BYTES is spent, after which (or on a missing object) the
// element keeps its placeholder. R2 is the same store the authenticated image
// endpoint reads (key = imageId), so a shared document's images embed without
// re-auth.
async function loadEmbeddedImages(env: Env, tab: Tab): Promise<Map<string, string>> {
  const images = env.IMAGES;
  if (!images) return new Map();
  return embedTabImages(
    tab,
    async (id) => {
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
