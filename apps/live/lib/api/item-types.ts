// A document's type catalogue on the wire (docs/specs/025-plan/item-types.md "Storage and sync"):
// PUT /documents/:id/item-types for a cloud document, the record for an offline one. The answer is
// the catalogue as stored (normalised), which the editor keeps.

import type { ItemTypesResponse } from '@livediagram/api-schema';
import { validateItemTypeCatalogue, type ItemTypeCatalogue } from '@livediagram/items';
import { isOfflineId, offlineSaveItemTypes } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

export async function saveItemTypes(
  scope: { ownerId: string; documentId: string; shareCode: string | null },
  itemTypes: ItemTypeCatalogue | null,
): Promise<ItemTypeCatalogue | null> {
  if (await isOfflineId(scope.documentId)) {
    // The same check the api makes, so an offline document never holds what a sync would refuse.
    let stored: ItemTypeCatalogue | null = null;
    if (itemTypes) {
      const checked = validateItemTypeCatalogue(itemTypes);
      if (!checked.ok) throw new Error(`item types refused: ${checked.reason}`);
      stored = checked.catalogue;
    }
    await offlineSaveItemTypes(scope.documentId, stored, Date.now());
    return stored;
  }
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(scope.documentId)}/item-types`,
    {
      method: 'PUT',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify({ itemTypes }),
    },
  );
  return (await expectOk<ItemTypesResponse>(res, 'item-types')).itemTypes;
}
