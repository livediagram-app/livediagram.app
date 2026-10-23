// /api/shape-libraries: a person's named sets of reusable shapes (docs/specs/013-workspace/shape-libraries.md),
// kept in their own Durable Object (person-client.ts). The requireOwner guard, the 400 / 404 conventions, list /
// create / update / delete; plus the per-person cap, the row budget, item validation and the name rules (blueprint
// "Interfaces and contracts"). The cap and name checks run inside the person's store, with the write.

import {
  MAX_SHAPE_LIBRARIES_PER_OWNER,
  MAX_TAB_BYTES,
  SHAPE_LIBRARY_SOURCES,
  normaliseLibraryName,
  shapeLibraryItemsBytes,
  validateShapeLibraryItems,
  type ShapeLibraryItem,
  type ShapeLibrarySource,
} from '@livediagram/api-schema';
import { renderElementsToSvg, type Tab } from '@livediagram/document';
import { resolveIconExportArt, resolveStickerArt } from '@livediagram/icons/resolve';
import { personStore } from '../person-client';
import { badRequest, conflict, json, noContent, notFound, payloadTooLarge } from '../responses';
import { requireOwner, type RouteContext, readBody } from './context';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// Every refusal is logged with its reason, then answered.
function rejected(reason: string, response: Response): Response {
  console.warn('[shape-libraries] rejected', { reason });
  return response;
}

// Items checked for shape and budget: the validated items, or the refusal to send.
function checkedItems(items: unknown): ShapeLibraryItem[] | Response {
  const valid = validateShapeLibraryItems(items);
  if (!valid.ok) return rejected(valid.reason, badRequest(`invalid items: ${valid.reason}`));
  const bytes = shapeLibraryItemsBytes(valid.items);
  if (bytes > MAX_TAB_BYTES) return rejected('too-large', payloadTooLarge());
  return valid.items;
}

export async function handleShapeLibraries(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'shape-libraries') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const store = personStore(env, owner);

  // /api/shape-libraries: list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      return json({ libraries: await store.shapeLibraries() });
    }
    if (request.method === 'POST') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read;
      const id = typeof body.id === 'string' ? body.id : '';
      if (!ID.test(id)) return rejected('invalid-id', badRequest('missing or invalid id'));
      const name = normaliseLibraryName(body.name);
      if (!name) return rejected('invalid-name', badRequest('missing or invalid name'));
      const source = body.source as ShapeLibrarySource;
      if (!SHAPE_LIBRARY_SOURCES.includes(source)) {
        return rejected('invalid-source', badRequest('missing or invalid source'));
      }
      const items = checkedItems(body.items);
      if (items instanceof Response) return items;
      const library = await store.createShapeLibrary(
        { id, name, source, items },
        MAX_SHAPE_LIBRARIES_PER_OWNER,
      );
      if (library === 'cap') return rejected('cap', conflict('shape_library_cap'));
      if (library === 'exists') return rejected('exists', conflict('shape_library_exists'));
      console.info('[shape-libraries] created', {
        id,
        items: items.length,
        bytes: shapeLibraryItemsBytes(items),
      });
      return json({ library }, { status: 201 });
    }
  }

  // /api/shape-libraries/<id>/previews: every shape of one library drawn as an SVG, by shape id, for an Explorer that
  // cannot draw them itself (liveworkspace.app's, and the Explorer on this site's /explorer). One request a library,
  // not one a shape; `?v=<updatedAt>` keys a cached answer to the library's version.
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

  // /api/shape-libraries/<id>: update / delete. Another person's library is not in this person's store, so it
  // answers as no library at all.
  if (segments.length === 3) {
    const libraryId = segments[2]!;
    if (!ID.test(libraryId)) return notFound();
    if (request.method === 'PUT') {
      const read = await readBody(ctx);
      if (read instanceof Response) return read;
      const body = read;
      const patch: { name?: string; items?: ShapeLibraryItem[] } = {};
      if (body.name !== undefined) {
        const name = normaliseLibraryName(body.name);
        if (!name) return rejected('invalid-name', badRequest('invalid name'));
        patch.name = name;
      }
      if (body.items !== undefined) {
        const items = checkedItems(body.items);
        if (items instanceof Response) return items;
        patch.items = items;
      }
      const library = await store.updateShapeLibrary(libraryId, patch);
      if (library === 'not_found') return notFound();
      if (library === 'name_taken') {
        return rejected('name-taken', conflict('shape_library_name_taken'));
      }
      return json({ library });
    }
    if (request.method === 'DELETE') {
      return (await store.deleteShapeLibrary(libraryId)) ? noContent() : notFound();
    }
  }
  return notFound();
}

// Each shape drawn by the same DOM-free renderer as a canvas's snapshot, on a transparent ground, so a tile shows it
// as the palette does. Its images are not fetched (a library shape keeps none of its own); its icons and stickers
// draw their real art. A shape the renderer cannot draw is left out, and its tile stays plain.
export function shapePreviews(items: readonly ShapeLibraryItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    try {
      const tab = {
        id: `library-item-${item.id}`,
        name: item.title,
        elements: item.elements,
      } as Tab;
      out[item.id] = renderElementsToSvg(tab, {
        padding: 4,
        background: 'transparent',
        resolveIconArt: resolveIconExportArt,
        resolveStickerArt,
      });
    } catch (error) {
      console.warn('[shape-libraries] preview failed', { item: item.id, error: String(error) });
    }
  }
  return out;
}
