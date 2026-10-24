// A document drawn as an SVG, for its preview (liveworkspace/docs/previews.md): the first tab (a Pages tab's first
// page), or one tab, with the shared DOM-free renderer, its images inlined and its icons drawn as their glyphs. Drawn
// in the document's Durable Object, where the content is, when liveworkspace's previews service asks the export door
// (document-room.ts `exportImage`); the platform stores it, decides when it is stale and serves it, so nothing here
// caches or writes a picture. Rendering on request means a document nobody looks at never costs a render.

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
// elements render their real glyph in the preview / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { getTab, getTabBody, type StoredTabBody, servableImageIds } from './db';
import { imageRefIds } from './image-refs/extract';
import { mediaClient } from './media';
import type { DocumentEnv } from './types';

// Ceiling on the raw image bytes inlined into one drawing. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the SVG by ~1.33x. Without a cap a document full
// of large photos would produce a multi-megabyte preview that's slow to
// store and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// The document fields a drawing needs.
export type DrawSubject = { id: string; name: string };

// The first tab (or `tabId`) drawn, or null when there is nothing to draw: no tab, an empty or unparseable one.
export async function drawDocument(
  env: DocumentEnv,
  doc: DrawSubject,
  tabId: string | null,
): Promise<string | null> {
  const body = tabId ? await getTabBody(env, doc.id, tabId) : await getTabBody(env, doc.id);
  return renderTabBodyToSvg(env, doc, body);
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a preview it draws an empty tab too, and with no image
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

// Turn a stored tab body into an SVG, for the first tab or one tab. Null when the body is absent, unparseable, or has
// nothing to draw (an empty document has no meaningful preview; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: DocumentEnv,
  liveDoc: DrawSubject,
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
  // side on the canvas shrinks to a row of slivers nobody can read at preview size.
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
