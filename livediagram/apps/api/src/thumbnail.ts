// A canvas drawn as an SVG, for its preview (liveworkspace/docs/specs/006-media/previews.md): the first tab, or one tab, with the shared
// DOM-free renderer, its images inlined and its icons drawn as their glyphs. Drawn in the canvas's Durable Object, where
// the content is, when liveworkspace's previews service asks the export door (document-room.ts `exportImage`); the
// platform stores it, decides when it is stale and serves it, so nothing here caches or writes a picture. Rendering
// on request means a canvas nobody looks at never costs a render.

import { embedTabImages } from '@livediagram/api-schema';
import {
  drawnCount,
  migrateStoredTab,
  renderElementsToSvg,
  tabAsSeen,
  type Appearance,
  type Tab,
} from '@livediagram/document';
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
import { redactTabForCommunity } from './community-redact';
import { mediaClient } from './media';
import type { DocumentEnv } from './types';

// Ceiling on the raw image bytes inlined into one drawing. The renderer
// embeds each referenced image as a base64 data URL (so the SVG is
// self-contained for the Explorer preview + the public live image), which
// inflates the SVG by ~1.33×. Without a cap a document full
// of large photos would produce a multi-megabyte preview that's slow to
// store and stream in the Explorer grid; images that would push past the
// budget fall back to their placeholder instead.
const IMAGE_EMBED_BUDGET_BYTES = 3 * 1024 * 1024;

// The canvas fields a drawing needs.
export type DrawSubject = { id: string; name: string };

// `defer` hands the count stamp (below) to a waitUntil, so the drawing goes out as soon as it is drawn.
// `appearance` is the reader's (docs/specs/006-document/document-snapshots.md "In the viewer's half"): the tab is drawn
// as a person in it sees it on opening it. Absent, it is drawn as stored (the live image, the share card).
export type DrawOptions = {
  defer?: (write: Promise<unknown>) => void;
  appearance?: Appearance | null;
};

// The first tab (or `tabId`) drawn, or null when there is nothing to draw: no tab, an empty or unparseable one.
// `community`: a Community visitor's drawing (docs/specs/025-community/community.md "Viewing a post's document"),
// from the redacted tab, so comment threads, their authors, action assignees, roll-call names and Q&A authors never
// reach the public card image or a Community thumbnail.
export async function drawDocument(
  env: DocumentEnv,
  doc: DrawSubject,
  tabId: string | null,
  opts: DrawOptions = {},
  community = false,
): Promise<string | null> {
  const body = tabId ? await getTabBody(env, doc.id, tabId) : await getTabBody(env, doc.id);
  return renderTabBodyToSvg(env, doc, body, opts, community);
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

// The lazy backfill of tabs.element_count (migration 0059): a tab stored before the count existed gets it
// from the parse a drawing does anyway, so the lists know an old empty document after one ask. Best effort:
// a failed stamp leaves the count unknown, which only means the row asks again.
function stampUnknownCount(
  env: DocumentEnv,
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
// nothing to draw (an empty canvas has no meaningful preview; the row shows its sketch instead).
async function renderTabBodyToSvg(
  env: DocumentEnv,
  liveDoc: DrawSubject,
  body: StoredTabBody | null,
  opts: DrawOptions = {},
  community = false,
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
  const stored = migrateStoredTab({ id: liveDoc.id, name: liveDoc.name, ...parsed } as Tab);
  const readable = community ? redactTabForCommunity(stored) : stored;
  const tab = opts.appearance ? tabAsSeen(readable, opts.appearance) : readable;
  // Inline referenced image bitmaps (from the media service) so the preview / live
  // image renders the actual photos, matching the in-app PNG/SVG export.
  const images = await loadEmbeddedImages(env, liveDoc.id, tab);
  const drawWith = {
    resolveImageHref: (id: string) => images.get(id),
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  };
  return renderElementsToSvg(tab, drawWith);
}

// Read each image element's bytes from the media service and return them keyed by imageId
// as base64 data URLs, ready for the renderer to inline. The shared embedder
// (@livediagram/api-schema embedTabImages) reads ids in document order until
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
  // The elements' images, as embedTabImages reads them.
  const ids = imageRefIds(tab.elements);
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
