// An offline project's item store (docs/specs/026-plan/items.md "Offline projects"): the items
// live in the project's own record, and every write is the same pure transition the api applies
// (@liveplanner/items applyItemWrite), serialised with the record's other writes. A write passes the
// api's own checks first (readItemWrite, writtenItemsRefusal) and is refused as the api refuses it, so
// the record never holds what Sync to Cloud would refuse.

import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  EMPTY_ITEM_STORE,
  applyItemWrite,
  legacyCatalogue,
  readItemWrite,
  typesOf,
  writtenItemsRefusal,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@liveplanner/items';
import { withoutLegacyThread } from '@liveplanner/project';
import { migratedRecord, threadsAfterItemWrite } from './offline-threads';
import { ApiError } from '../api/core';
import {
  offlineGetRecord,
  offlineUpdateRecord,
  serializeOfflineWrite,
  type OfflineProjectRecord,
} from './offline-store';
import type { ItemWriteAnswer } from '../api/items';

export function recordItemStore(rec: OfflineProjectRecord | null): ItemStoreState {
  if (!rec) return EMPTY_ITEM_STORE;
  // A card's old single thread is a thread now (offline-threads.ts), never one of its fields.
  return {
    items: (rec.items ?? []).map(withoutLegacyThread),
    rev: rec.itemsRev ?? 0,
    nextKey: rec.itemsNextKey ?? 1,
  };
}

export async function offlineFetchItems(projectId: string): Promise<ItemStoreState> {
  return recordItemStore(await offlineGetRecord(projectId));
}

const STATUS = { item_not_found: 404, item_exists: 409, items_full: 413 } as const;

// A write the api's checks refuse: the 400 the api answers, by the same name.
function refused(error: string): ApiError {
  debugLog('[items] items.offline.rejected', { error });
  return new ApiError('item write', 400, error);
}

export async function offlineWriteItem(
  projectId: string,
  write: ItemWrite,
  by: ItemPerson,
): Promise<ItemWriteAnswer> {
  return serializeOfflineWrite(async () => {
    let answer: ItemWriteAnswer | undefined;
    // The api's own checks (write-checks), then the write, in one transaction (offlineUpdateRecord).
    const read = readItemWrite(write);
    if ('error' in read) throw refused(read.error);
    await offlineUpdateRecord(projectId, (stored) => {
      if (!stored || stored.trashedAt !== undefined)
        throw new ApiError('item write', 404, 'not_found');
      const rec = migratedRecord(stored);
      const store = recordItemStore(rec);
      const result = applyItemWrite(store, read, { now: Date.now(), by });
      if (!result.ok) throw new ApiError('item write', STATUS[result.error], result.error);
      const types = typesOf(legacyCatalogue(rec.itemTypes ?? null, store.items.length > 0));
      const after = writtenItemsRefusal(read, store.items, result.upserts, types);
      if (after) throw refused(after.error);
      const { items, rev, nextKey } = result.state;
      answer = { upserts: result.upserts, removed: result.removed, rev };
      // A card deleted for good leaves its threads; one put back goes back on them (the write as sent: its creates
      // carry the threads).
      const threads = threadsAfterItemWrite(rec.threads ?? [], write, projectId, result.upserts);
      return {
        ...rec,
        items,
        itemsRev: rev,
        itemsNextKey: nextKey,
        ...(threads.length || rec.threads ? { threads } : {}),
      };
    });
    debugLog('[items] items.offline.write', { kind: write.kind });
    return answer!;
  });
}
