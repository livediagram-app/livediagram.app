// A project's type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"): PUT
// /api/projects/:id/item-types stores the whole catalogue (or null, the default types) for anyone
// who may edit the whole project, validated by @liveplanner/items, and relays it to the room as an
// ordered `item-types` op. Reading it is the project's GET (`itemTypes`, `itemTypesRev`). A write naming
// the revision it changed (`expectedRev`) lands only while that is still the stored one; otherwise it is
// refused with what is stored, so two editors saving at once never overwrite each other.

import type { ItemTypesResponse, ItemTypesStale } from '@liveplanner/api-schema';
import { validateItemTypeCatalogue, type ItemTypeCatalogue } from '@liveplanner/items';
import { getProject } from '../db';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { badRequest, forbidden, json, methodNotAllowed } from '../responses';
import { relayItemTypes } from '../room-client';
import { gateEdit, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

async function put(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  // The catalogue is the whole project's: a grant confined to one tab may not change it.
  if (!(await gateEdit(ctx, projectId, doc.ownerId, doc.teamId))) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (!('itemTypes' in body)) return badRequest('expected { itemTypes }');
  const expectedRev = body.expectedRev;
  if (
    expectedRev !== undefined &&
    (typeof expectedRev !== 'number' || !Number.isInteger(expectedRev) || expectedRev < 0)
  )
    return badRequest('expectedRev must be a whole number');
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
  const itemTypesRev = await setPlanItemTypes(ctx.env, projectId, itemTypes, expectedRev);
  if (itemTypesRev === null) {
    // Someone else's change landed since the caller read the catalogue: answer with what is stored.
    const stored = await getProject(ctx.env, projectId);
    console.info('[item-types] item-types.stale', { expectedRev, rev: stored?.itemTypesRev });
    const stale: ItemTypesStale = {
      error: 'item_types_stale',
      itemTypes: stored?.itemTypes ?? null,
      itemTypesRev: stored?.itemTypesRev ?? 0,
    };
    return json(stale, { status: 409 });
  }
  console.info('[item-types] item-types.saved', {
    types: itemTypes?.types.length ?? null,
    rev: itemTypesRev,
  });
  ctx.waitUntil?.(
    relayItemTypes(ctx.env, projectId, { kind: 'item-types', itemTypes, itemTypesRev }),
  );
  const answer: ItemTypesResponse = { itemTypes, itemTypesRev };
  return json(answer);
}

export async function handleItemTypeRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments.length !== 4 || segments[3] !== 'item-types') return null;
  const projectId = segments[2]!;
  return request.method === 'PUT' ? put(ctx, projectId) : methodNotAllowed();
}
