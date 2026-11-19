// A range's flow, as the flow charts read it (docs/specs/026-plan/plan-views.md "Flow charts", blueprint item-store.md
// "Flow read"): one request per range, every card type (each chart keeps its own), shared by the charts of that range
// (hooks/plan/plan-flow-store.ts). An offline plan keeps no history or counts, so it is never asked. A session on
// a tab-scoped link names its tab.

import type { FlowResponse } from '@liveplanner/api-schema';
import { isOfflineId } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';
import type { ItemsScope } from './items';

export async function fetchFlow(
  scope: ItemsScope,
  days: number,
): Promise<FlowResponse | 'offline'> {
  if (await isOfflineId(scope.projectId)) return 'offline';
  const enc = encodeURIComponent;
  const tab = scope.tabId ? `&tabId=${enc(scope.tabId)}` : '';
  const res = await apiFetch(
    `${API_BASE}/projects/${enc(scope.projectId)}/flow?days=${days}${tab}`,
    {
      headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
    },
  );
  return expectOk<FlowResponse>(res, 'flow');
}
