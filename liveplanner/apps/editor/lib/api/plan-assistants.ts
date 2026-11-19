// The AI assistants a plan remembers (docs/specs/026-plan/items.md "Who it can be handed to"; blueprint item-store.md
// "The assistant on the card"): read for the Assignee picker. An offline plan has none (no token reaches it), and a
// tab-scoped link reads none.
import type { ItemAssistantsResponse } from '@liveplanner/api-schema';
import type { ItemAssistant } from '@liveplanner/items';
import { isOfflineId } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';
import type { ItemsScope } from './items';

export async function apiPlanAssistants(scope: ItemsScope): Promise<ItemAssistant[]> {
  if (scope.tabId || (await isOfflineId(scope.projectId))) return [];
  const res = await apiFetch(
    `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/items/assistants`,
    { headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }) },
  );
  return (await expectOk<ItemAssistantsResponse>(res, 'assistants')).assistants;
}
