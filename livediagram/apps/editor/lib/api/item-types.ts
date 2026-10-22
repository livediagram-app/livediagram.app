// A document's type catalogue on the wire (docs/specs/026-plan/item-types.md "Storage and sync"):
// PUT /documents/:id/item-types for a cloud document, the record for an offline one. The save names
// the catalogue's revision it changed; the answer is the catalogue as stored (normalised) with its new
// revision, which the editor keeps. A revision that moved on throws ItemTypesStaleError with what is stored.

import type { ItemTypesResponse, ItemTypesStale } from '@livediagram/api-schema';
import {
  readItemTypeCatalogue,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from '@livediagram/items';
import { isOfflineId, offlineSaveItemTypes } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export type SavedItemTypes = { itemTypes: ItemTypeCatalogue | null; itemTypesRev: number };

// Another change landed since the revision a save named: the catalogue and revision now stored.
export class ItemTypesStaleError extends Error {
  readonly stored: SavedItemTypes;
  constructor(stored: SavedItemTypes) {
    super('item types changed meanwhile');
    this.name = 'ItemTypesStaleError';
    this.stored = stored;
  }
}

export async function saveItemTypes(
  scope: { ownerId: string; documentId: string; shareCode: string | null },
  itemTypes: ItemTypeCatalogue | null,
  expectedRev: number,
): Promise<SavedItemTypes> {
  if (await isOfflineId(scope.documentId)) {
    // The same check the api makes, so an offline document never holds what a sync would refuse.
    let stored: ItemTypeCatalogue | null = null;
    if (itemTypes) {
      const checked = validateItemTypeCatalogue(itemTypes);
      if (!checked.ok) throw new Error(`item types refused: ${checked.reason}`);
      stored = checked.catalogue;
    }
    await offlineSaveItemTypes(scope.documentId, stored, Date.now());
    // Only this editor writes an offline document: its revision is only ever the next one.
    return { itemTypes: stored, itemTypesRev: expectedRev + 1 };
  }
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(scope.documentId)}/item-types`,
    {
      method: 'PUT',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify({ itemTypes, expectedRev }),
    },
  );
  if (res.status === 409) {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as Partial<ItemTypesStale> | null;
    // Expected under concurrent edits, so not reported as an error: the caller makes its change again.
    if (body?.error === 'item_types_stale' && typeof body.itemTypesRev === 'number')
      throw new ItemTypesStaleError({
        itemTypes: readItemTypeCatalogue(body.itemTypes ?? null),
        itemTypesRev: body.itemTypesRev,
      });
  }
  const answer = await expectOk<ItemTypesResponse>(res, 'item-types');
  return { itemTypes: answer.itemTypes, itemTypesRev: answer.itemTypesRev };
}
