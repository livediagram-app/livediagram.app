// A card's history, as the editor reads it (docs/specs/026-plan/items.md "History", blueprint item-store.md
// "History"): one request for one card, when its panel opens. An offline plan keeps none, so it is never asked.
// A session on a tab-scoped link names its tab.

import type { ItemHistoryResponse, ItemSessionRequest } from '@liveplanner/api-schema';
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

// A Session tab's outcome for one card, kept in its history (docs/specs/026-plan/session-tabs.md "History"): the
// facilitator's screen sends it as the session decides. An offline plan keeps no history, so it sends nothing.
export async function recordSessionOutcome(
  scope: ItemsScope,
  itemId: string,
  body: ItemSessionRequest,
): Promise<void> {
  if (await isOfflineId(scope.projectId)) return;
  const enc = encodeURIComponent;
  const q = scope.tabId ? `?tabId=${enc(scope.tabId)}` : '';
  const res = await apiFetch(
    `${API_BASE}/projects/${enc(scope.projectId)}/items/${enc(itemId)}/session${q}`,
    {
      method: 'POST',
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await expectOk<unknown>(res, 'session outcome');
}
