// /api/shape-libraries: owner-scoped named sets of reusable shapes
// (docs/specs/013-workspace/shape-libraries.md). Mirrors /api/custom-themes: the requireOwner guard,
// the 400 / 403 / 404 conventions, list / create / update / delete; plus the per-owner cap, the
// row budget, item validation and the name rules (blueprint "Interfaces and contracts").

import {
  MAX_SHAPE_LIBRARIES_PER_OWNER,
  MAX_TAB_BYTES,
  SHAPE_LIBRARY_SOURCES,
  normaliseLibraryName,
  shapeLibraryItemsBytes,
  uniqueLibraryName,
  validateShapeLibraryItems,
  type ShapeLibraryItem,
  type ShapeLibrarySource,
} from '@livediagram/api-schema';
import {
  createShapeLibrary,
  deleteShapeLibrary,
  getShapeLibrary,
  listShapeLibrariesByOwner,
  shapeLibraryNamesByOwner,
  updateShapeLibrary,
} from '../db';
import {
  badRequest,
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  payloadTooLarge,
} from '../responses';
import { requireOwner, type RouteContext } from './context';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// Every refusal is logged with its reason, then answered.
function rejected(reason: string, response: Response): Response {
  console.warn('[shape-libraries] rejected', { reason });
  return response;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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

  // /api/shape-libraries: list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      return json({ libraries: await listShapeLibrariesByOwner(env, owner) });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
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
      const taken = await shapeLibraryNamesByOwner(env, owner);
      if (taken.length >= MAX_SHAPE_LIBRARIES_PER_OWNER) {
        return rejected('cap', conflict('shape_library_cap'));
      }
      if (await getShapeLibrary(env, id))
        return rejected('exists', conflict('shape_library_exists'));
      const library = await createShapeLibrary(env, {
        id,
        ownerId: owner,
        name: uniqueLibraryName(name, taken),
        source,
        items,
      });
      console.info('[shape-libraries] created', {
        id,
        items: items.length,
        bytes: shapeLibraryItemsBytes(items),
      });
      return json({ library }, { status: 201 });
    }
  }

  // /api/shape-libraries/<id>: update / delete
  if (segments.length === 3) {
    const libraryId = segments[2]!;
    const existing = await getShapeLibrary(env, libraryId);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();
    if (request.method === 'PUT') {
      const body = (await request.json()) as Record<string, unknown>;
      const patch: { name?: string; items?: ShapeLibraryItem[] } = {};
      if (body.name !== undefined) {
        const name = normaliseLibraryName(body.name);
        if (!name) return rejected('invalid-name', badRequest('invalid name'));
        const others = (await shapeLibraryNamesByOwner(env, owner)).filter(
          (n) => !sameName(n, existing.name),
        );
        if (others.some((n) => sameName(n, name))) {
          return rejected('name-taken', conflict('shape_library_name_taken'));
        }
        patch.name = name;
      }
      if (body.items !== undefined) {
        const items = checkedItems(body.items);
        if (items instanceof Response) return items;
        patch.items = items;
      }
      await updateShapeLibrary(env, libraryId, patch);
      return json({ library: await getShapeLibrary(env, libraryId) });
    }
    if (request.method === 'DELETE') {
      await deleteShapeLibrary(env, libraryId);
      return noContent();
    }
  }
  return notFound();
}
