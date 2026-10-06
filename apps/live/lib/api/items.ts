// The item store's client (docs/specs/026-plan/items.md, blueprint item-store.md "Editor slice").
// Each call dispatches an offline document to its local store (../offline/offline-items) and a
// cloud document to the api. A session on a tab-scoped link names its tab on every call.

import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import {
  ITEM_BULK_MAX,
  type Item,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@livediagram/items';
import { isOfflineId } from '../offline/offline-store';
import { offlineFetchItems, offlineWriteItem } from '../offline/offline-items';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

export type ItemsScope = {
  ownerId: string;
  documentId: string;
  shareCode: string | null;
  // The tab a tab-scoped link confines this session to; null for the whole document.
  tabId: string | null;
};

// What a write changed: the items as stored, the removed ids, and the store's rev (-1 when the
// answer does not say; the room's op carries it).
export type ItemWriteAnswer = { upserts: Item[]; removed: string[]; rev: number };

function itemsUrl(scope: ItemsScope, rest = ''): string {
  const q = scope.tabId ? `?tabId=${encodeURIComponent(scope.tabId)}` : '';
  return `${API_BASE}/documents/${encodeURIComponent(scope.documentId)}/items${rest}${q}`;
}

export async function fetchItems(scope: ItemsScope): Promise<ItemStoreState> {
  if (await isOfflineId(scope.documentId)) return offlineFetchItems(scope.documentId);
  const res = await apiFetch(itemsUrl(scope), {
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
  });
  const body = await expectOk<ItemsResponse>(res, 'items');
  const maxKey = Math.max(0, ...body.items.map((i) => i.key));
  return { items: body.items, rev: body.rev, nextKey: maxKey + 1 };
}

async function post<T>(scope: ItemsScope, rest: string, body: unknown, action: string): Promise<T> {
  const res = await apiFetch(itemsUrl(scope, rest), {
    method: 'POST',
    headers: await apiHeaders(scope.ownerId, { share: scope.shareCode, body: true }),
    body: JSON.stringify(body),
  });
  return expectOk<T>(res, action);
}

const one = (r: ItemResponse): ItemWriteAnswer => ({ upserts: [r.item], removed: [], rev: r.rev });

// Sends one write. `by` signs an offline write; the api signs a cloud one itself.
export async function writeItem(
  scope: ItemsScope,
  write: ItemWrite,
  by: ItemPerson,
): Promise<ItemWriteAnswer> {
  if (await isOfflineId(scope.documentId)) return offlineWriteItem(scope.documentId, write, by);
  const id = 'id' in write ? `/${encodeURIComponent(write.id)}` : '';
  switch (write.kind) {
    case 'create': {
      if (write.creates.length === 1)
        return one(await post(scope, '', write.creates[0], 'item create'));
      const answer: ItemWriteAnswer = { upserts: [], removed: [], rev: -1 };
      for (let i = 0; i < write.creates.length; i += ITEM_BULK_MAX) {
        const r = await post<ItemsResponse>(
          scope,
          '/bulk',
          { items: write.creates.slice(i, i + ITEM_BULK_MAX) },
          'items create',
        );
        answer.upserts.push(...r.items);
        answer.rev = r.rev;
      }
      return answer;
    }
    case 'patch':
      return one(await post(scope, id, write.patch, 'item change'));
    case 'move':
      return one(await post(scope, `${id}/move`, write.move, 'item move'));
    case 'vote':
      return one(await post(scope, `${id}/vote`, { delta: write.delta }, 'item vote'));
    case 'delete': {
      const res = await apiFetch(itemsUrl(scope, id), {
        method: 'DELETE',
        headers: await apiHeaders(scope.ownerId, { share: scope.shareCode }),
      });
      await expectOkVoid(res, 'item delete');
      return { upserts: [], removed: [write.id], rev: -1 };
    }
  }
}
