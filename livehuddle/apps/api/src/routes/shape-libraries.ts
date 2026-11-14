// /api/shape-libraries: a person's named sets of reusable shapes (docs/specs/013-workspace/shape-libraries.md), kept
// in their own Durable Object (person-client.ts), READ-ONLY since Work Tracker #515 (docs/specs/002-project-scope/
// not-in-livehuddle.md "Shape libraries: kept read-only"): the list and the previews, and nothing that writes. A
// write is refused for every caller before the store is reached, so the read path pays nothing for it. Account
// deletion and the guest-to-account move still reach the store directly (db/account.ts).

import type { ShapeLibraryItem } from '@livehuddle/api-schema';
import { renderElementsToSvg, type Tab } from '@livehuddle/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { personStore } from '../person-client';
import { forbidden, json, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// The error token a refused write answers with, beside the 403 the api gives any write it will not take.
export const SHAPE_LIBRARIES_READ_ONLY = 'shape_libraries_read_only';

export async function handleShapeLibraries(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'shape-libraries') return notFound();
  // The three writes the resource once had: POST on the collection, PUT and DELETE on one library.
  const { method } = request;
  const isWrite =
    (segments.length === 2 && method === 'POST') ||
    (segments.length === 3 && ID.test(segments[2]!) && (method === 'PUT' || method === 'DELETE'));
  if (isWrite) {
    console.warn('[shape-libraries] write refused', { method });
    return forbidden(SHAPE_LIBRARIES_READ_ONLY);
  }
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const store = personStore(env, owner);

  // /api/shape-libraries: list
  if (segments.length === 2 && request.method === 'GET') {
    return json({ libraries: await store.shapeLibraries() });
  }

  // /api/shape-libraries/<id>/previews: every shape of one library drawn as an SVG, by shape id, for an Explorer that
  // cannot draw them itself (liveworkspace.app's, and the Explorer on this site's /explorer). One request a library,
  // not one a shape; `?v=<updatedAt>` keys a cached answer to the library's version. Another person's library is not
  // in this person's store, so it answers as no library at all.
  if (segments.length === 4 && segments[3] === 'previews' && request.method === 'GET') {
    const libraryId = segments[2]!;
    if (!ID.test(libraryId)) return notFound();
    const library = await store.shapeLibrary(libraryId);
    if (!library) return notFound();
    return json(
      { previews: shapePreviews(library.items) },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  }
  return notFound();
}

// The most one previews answer carries, in bytes of its JSON before compression (Work Tracker 695). The largest library
// a person may keep, of the square, circle and diamond an import stored (retired kinds, drawn as outlines), measures
// 1.06 MB, so it is drawn whole; a library of kept kinds with rich faces reached 5.8 to 7.5 MB, and now stops here.
export const SHAPE_PREVIEWS_MAX_BYTES = 1_200_000;

// Each shape drawn by the same DOM-free renderer as a canvas's snapshot, on a transparent ground, so a tile shows it
// as the palette does. Its images are not fetched (a library shape keeps none of its own); its icons and stickers
// draw their real art. A retired element (a kind livehuddle no longer has, as most stored library shapes are) draws its
// placeholder's dashed outline alone: its words cannot be read on a tile and doubled the answer. A shape the renderer
// cannot draw is left out, and its tile stays plain; so are the shapes past SHAPE_PREVIEWS_MAX_BYTES, in library order.
export function shapePreviews(items: readonly ShapeLibraryItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  // The answer's `{"previews":{}}` and, per drawing, its quoted id, its quoted escaped SVG, a colon and a comma.
  let bytes = 16;
  for (const item of items) {
    try {
      const tab = {
        id: `library-item-${item.id}`,
        name: item.title,
        elements: item.elements,
      } as Tab;
      const svg = renderElementsToSvg(tab, {
        padding: 4,
        background: 'transparent',
        resolveIconArt: resolveIconExportArt,
        resolveStickerArt,
        retiredOutlines: true,
      });
      bytes += JSON.stringify(item.id).length + JSON.stringify(svg).length + 2;
      if (bytes > SHAPE_PREVIEWS_MAX_BYTES) {
        console.warn('[shape-libraries] previews budget reached', {
          drawn: Object.keys(out).length,
          items: items.length,
        });
        break;
      }
      out[item.id] = svg;
    } catch (error) {
      console.warn('[shape-libraries] preview failed', { item: item.id, error: String(error) });
    }
  }
  return out;
}
