// A document's type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"): PUT
// /api/documents/:id/item-types stores the whole catalogue (or null, the built-in types) for anyone
// who may edit the whole document, validated by @livediagram/items, and relays it to the room as an
// ordered `item-types` op. Reading it is the document's GET (`itemTypes`).

import type { ItemTypesResponse } from '@livediagram/api-schema';
import { validateItemTypeCatalogue, type ItemTypeCatalogue } from '@livediagram/items';
import { getDocument, setDocumentItemTypes } from '../db';
import { badRequest, forbidden, json, methodNotAllowed } from '../responses';
import { relayItemTypes } from '../room-client';
import { gateEdit, missingDocument, readBody, requireOwner, type RouteContext } from './context';

async function put(ctx: RouteContext, documentId: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  // The catalogue is the whole document's: a grant confined to one tab may not change it.
  if (!(await gateEdit(ctx, documentId, doc.ownerId, doc.teamId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (!('itemTypes' in body)) return badRequest('expected { itemTypes }');
  const raw = body.itemTypes;
  let itemTypes: ItemTypeCatalogue | null = null;
  if (raw !== null) {
    const result = validateItemTypeCatalogue(raw);
    if (!result.ok) {
      console.info('[item-types] item-types.rejected', { reason: result.reason });
      return json({ error: 'item_types_invalid', reason: result.reason }, { status: 400 });
    }
    itemTypes = result.catalogue;
  }
  await setDocumentItemTypes(ctx.env, documentId, itemTypes);
  console.info('[item-types] item-types.saved', {
    types: itemTypes?.types.length ?? null,
  });
  ctx.waitUntil?.(relayItemTypes(ctx.env, documentId, { kind: 'item-types', itemTypes }));
  const answer: ItemTypesResponse = { itemTypes };
  return json(answer);
}

export async function handleItemTypeRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'item-types') return null;
  const documentId = segments[2]!;
  return request.method === 'PUT' ? put(ctx, documentId) : methodNotAllowed();
}
