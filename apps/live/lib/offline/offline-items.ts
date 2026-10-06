// An offline document's item store (docs/specs/026-plan/items.md "Offline documents"): the items
// live in the document's own record, and every write is the same pure transition the api applies
// (@livediagram/items applyItemWrite), serialised with the record's other writes.

import { debugLog } from '@/lib/debug-log';
import {
  EMPTY_ITEM_STORE,
  applyItemWrite,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@livediagram/items';
import { ApiError } from '../api/core';
import {
  offlineGetRecord,
  offlinePutRecord,
  serializeOfflineWrite,
  type OfflineDocumentRecord,
} from './offline-store';
import type { ItemWriteAnswer } from '../api/items';

export function recordItemStore(rec: OfflineDocumentRecord | null): ItemStoreState {
  if (!rec) return EMPTY_ITEM_STORE;
  return { items: rec.items ?? [], rev: rec.itemsRev ?? 0, nextKey: rec.itemsNextKey ?? 1 };
}

export async function offlineFetchItems(documentId: string): Promise<ItemStoreState> {
  return recordItemStore(await offlineGetRecord(documentId));
}

const STATUS = { item_not_found: 404, item_exists: 409, items_full: 413 } as const;

export async function offlineWriteItem(
  documentId: string,
  write: ItemWrite,
  by: ItemPerson,
): Promise<ItemWriteAnswer> {
  return serializeOfflineWrite(async () => {
    const rec = await offlineGetRecord(documentId);
    if (!rec || rec.trashedAt !== undefined) throw new ApiError('item write', 404, 'not_found');
    const result = applyItemWrite(recordItemStore(rec), write, { now: Date.now(), by });
    if (!result.ok) throw new ApiError('item write', STATUS[result.error], result.error);
    const { items, rev, nextKey } = result.state;
    await offlinePutRecord({ ...rec, items, itemsRev: rev, itemsNextKey: nextKey });
    debugLog('[items] items.offline.write', { kind: write.kind });
    return { upserts: result.upserts, removed: result.removed, rev };
  });
}
