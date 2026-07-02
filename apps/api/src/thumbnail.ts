// Diagram SVG snapshot render-cache (spec/67). One cached SVG per
// diagram, stored in R2 (key `thumb/<diagramId>`), refreshed lazily on
// read: if the cache is fresh (rendered at or after the diagram's last
// save) we stream the stored bytes; otherwise we render the first tab
// with the shared DOM-free renderer, write it back, and stamp it fresh.
//
// Two delivery paths share this one artifact (the whole point of the
// design): the owner-authed Explorer thumbnail (GET
// /api/diagrams/:id/thumbnail) and the public, share-code-scoped live
// image (GET /api/share/:code/image.svg). Rendering on read — rather
// than on every save — means a diagram nobody looks at never costs a
// render, and every write path (editor, collaborators, MCP, API token)
// invalidates the snapshot uniformly because they all bump saved_at.

import { renderElementsToSvg, type Tab } from '@livediagram/diagram';
// Static-import icon resolver (bundle size is fine in a Worker) so icon
// elements render their real glyph in the snapshot / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt } from '@livediagram/icons/resolve';
import {
  getFirstTabData,
  getTabData,
  getThumbRenderedAt,
  markThumbRendered,
  thumbnailKey,
} from './db';
import type { DiagramDTO, Env } from './types';

// Content type for the cached SVG snapshot. Local to this module — the
// HTTP responses set their own header (responses.ts); this only stamps
// the R2 object's metadata on write.
const THUMBNAIL_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

// Ceiling on the raw image bytes inlined into one snapshot. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the cached/streamed SVG by ~1.33×. Without a cap a diagram full
// of large photos would produce a multi-megabyte thumbnail that's slow to
// cache and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// Resolve a diagram's cached SVG snapshot, rendering + caching it first
// if stale. Returns null — caller should 404 / fall back to an icon —
// when there's nothing to show: no R2 binding (self-host without
// storage), no tab, or an empty / unparseable first tab.
export async function getDiagramThumbnailSvg(
  env: Env,
  diagram: DiagramDTO,
): Promise<string | null> {
  // No object store: nothing to cache into or read from. The endpoints
  // 404 and the Explorer row keeps its generic icon, same graceful
  // degradation as the image gallery (spec/19) on a binding-less deploy.
  if (!env.IMAGES) return null;
  const key = thumbnailKey(diagram.id);

  // Fresh = rendered at or after the last save. saved_at is bumped by
  // every tab write, so any content change makes the snapshot stale.
  const renderedAt = await getThumbRenderedAt(env, diagram.id);
  if (renderedAt !== null && renderedAt >= diagram.savedAt) {
    const cached = await env.IMAGES.get(key);
    // A present object is the happy path. A miss here means the object
    // was evicted / never written despite the freshness stamp, so we
    // fall through and re-render rather than 404 a diagram that has
    // content.
    if (cached) return await cached.text();
  }

  const svg = await renderFirstTab(env, diagram);
  if (svg == null) return null;

  // Best effort: a write failure (R2 hiccup) must not fail the read —
  // we still return the freshly rendered SVG, just without caching it,
  // so the next read renders again. Only stamp the row as fresh once the
  // object is actually in R2, or a later read would trust a stale/absent
  // object and skip the re-render.
  try {
    await env.IMAGES.put(key, svg, { httpMetadata: { contentType: THUMBNAIL_CONTENT_TYPE } });
    await markThumbRendered(env, diagram.id, Date.now());
  } catch {
    // Swallow: the SVG is still returned to the caller below.
  }
  return svg;
}

// Live image for a SPECIFIC tab (spec/54's per-tab picker, now surfaced
// in the Share dialog). Rendered on read and deliberately NOT written to
// the R2 snapshot cache: `thumb/<diagramId>` is the first-tab artifact
// shared with the Explorer thumbnail (spec/67) and carries a single
// per-diagram freshness stamp, so it has no room for a second tab. A
// non-default tab is a niche embed, and the endpoint's short
// stale-while-revalidate Cache-Control keeps repeat views cheap without
// a persistent cache. Returns null (caller 404s) when there's no object
// store, the tab isn't in the diagram, or the tab is empty / unparseable.
export async function getDiagramTabImageSvg(
  env: Env,
  diagram: DiagramDTO,
  tabId: string,
): Promise<string | null> {
  // Gate on the same optional R2 binding as the cached path, so the
  // whole live-image feature is uniformly off on a binding-less deploy.
  if (!env.IMAGES) return null;
  const data = await getTabData(env, diagram.id, tabId);
  return renderTabDataToSvg(env, diagram, data);
}

// Render the diagram's first tab to SVG, or null when the tab is
// missing, unparseable, or has no elements (an empty canvas has no
// meaningful thumbnail — the row shows its icon instead).
async function renderFirstTab(env: Env, diagram: DiagramDTO): Promise<string | null> {
  return renderTabDataToSvg(env, diagram, await getFirstTabData(env, diagram.id));
}

// Turn a raw `tabs.data` body into an SVG, shared by the first-tab
// snapshot and the per-tab live image. Null when the data is absent,
// unparseable, or has no elements.
async function renderTabDataToSvg(
  env: Env,
  diagram: DiagramDTO,
  data: string | null,
): Promise<string | null> {
  if (!data) return null;
  let parsed: Partial<Tab>;
  try {
    parsed = JSON.parse(data) as Partial<Tab>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  const tab = { id: diagram.id, name: diagram.name, ...parsed } as Tab;
  // Inline referenced image bitmaps (read from R2) so the preview / live
  // image renders the actual photos, matching the in-app PNG/SVG export.
  const images = await loadEmbeddedImages(env, tab);
  return renderElementsToSvg(tab, {
    resolveImageHref: (id) => images.get(id),
    resolveIconArt: resolveIconExportArt,
  });
}

// Read each image/avatar element's bytes from R2 and return them keyed by
// imageId as base64 data URLs, ready for the renderer to inline. Honours
// IMAGE_EMBED_BUDGET_BYTES: ids are read in document order until the budget
// is spent, after which (or on a missing object) the element keeps its
// placeholder. R2 is the same store the authenticated image endpoint reads
// (key = imageId), so a shared diagram's images embed without re-auth.
async function loadEmbeddedImages(env: Env, tab: Tab): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!env.IMAGES) return map;
  const ids = Array.from(
    new Set(tab.elements.flatMap((el) => (el.type === 'image' && el.imageId ? [el.imageId] : []))),
  );
  let budget = IMAGE_EMBED_BUDGET_BYTES;
  for (const id of ids) {
    const object = await env.IMAGES.get(id);
    if (!object) continue;
    const buf = await object.arrayBuffer();
    if (buf.byteLength > budget) continue; // keep the snapshot bounded
    budget -= buf.byteLength;
    const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
    map.set(id, `data:${contentType};base64,${bytesToBase64(new Uint8Array(buf))}`);
  }
  return map;
}

// Base64-encode bytes without Node's Buffer (Workers runtime). Chunked
// through String.fromCharCode so a large image doesn't blow the argument
// limit of a single spread.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
