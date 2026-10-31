// A card's history, as the editor reads it (docs/specs/026-plan/items.md "History", blueprint item-store.md
// "History"): one request for one card, when its panel opens. A This Browser plan keeps none, so it is never asked.
// A session on a tab-scoped link names its tab.

import type { ItemHistoryResponse } from '@liveplanner/api-schema';
import type { ItemHistoryEntry } from '@liveplanner/items';
import { isOfflineId } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';
import type { ItemsScope } from './items';

export async function fetchItemHistory(
  scope: ItemsScope,
  itemId: string,
): Promise<ItemHistoryEntry[] | 'offline'> {
  if (await isOfflineId(scope.projectId)) return 'offline';
  const enc = encodeURIComponent;
  const q = scope.tabId ? `?tabId=${enc(scope.tabId)}` : '';
  const res = await apiFetch(
    `${API_BASE}/projects/${enc(scope.projectId)}/items/${enc(itemId)}/history${q}`,
    { headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }) },
  );
  return (await expectOk<ItemHistoryResponse>(res, 'card history')).entries;
}
