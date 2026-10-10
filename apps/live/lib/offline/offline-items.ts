// An offline document's item store (docs/specs/026-plan/items.md "Offline documents"): the items
// live in the document's own record, and every write is the same pure transition the api applies
// (@livediagram/items applyItemWrite), serialised with the record's other writes. A write passes the
// api's own checks first (readItemWrite, writtenItemsRefusal) and is refused as the api refuses it, so
// the record never holds what Sync to Cloud would refuse.

import { debugLog } from '@/lib/debug-log';
import {
  EMPTY_ITEM_STORE,
  applyItemWrite,
  readItemWrite,
  typesOf,
  writtenItemsRefusal,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
} from '@livediagram/items';
import { applyItemComment, type ItemCommentChange } from '@livediagram/document';
import { ApiError } from '../api/core';
import {
  offlineGetRecord,
  offlineUpdateRecord,
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

// A write the api's checks refuse: the 400 the api answers, by the same name.
function refused(error: string): ApiError {
  debugLog('[items] items.offline.rejected', { error });
  return new ApiError('item write', 400, error);
}

export async function offlineWriteItem(
  documentId: string,
  write: ItemWrite,
  by: ItemPerson,
): Promise<ItemWriteAnswer> {
  return serializeOfflineWrite(async () => {
    let answer: ItemWriteAnswer | undefined;
    // The api's own checks (write-checks), then the write, in one transaction (offlineUpdateRecord).
    const read = readItemWrite(write);
    if ('error' in read) throw refused(read.error);
    await offlineUpdateRecord(documentId, (rec) => {
      if (!rec || rec.trashedAt !== undefined) throw new ApiError('item write', 404, 'not_found');
      const store = recordItemStore(rec);
      const result = applyItemWrite(store, read, { now: Date.now(), by });
      if (!result.ok) throw new ApiError('item write', STATUS[result.error], result.error);
      const after = writtenItemsRefusal(read, store.items, result.upserts, typesOf(rec.itemTypes));
      if (after) throw refused(after.error);
      const { items, rev, nextKey } = result.state;
      answer = { upserts: result.upserts, removed: result.removed, rev };
      return { ...rec, items, itemsRev: rev, itemsNextKey: nextKey };
    });
    debugLog('[items] items.offline.write', { kind: write.kind });
    return answer!;
  });
}

const COMMENT_STATUS = { comments_full: 413, comment_not_found: 404 } as const;

// A card's comment change on an offline document (docs/specs/026-plan/items.md "Comments"): the same pure
// transition the api applies, on the record's item. Null when it changed nothing (a resolve already so).
export async function offlineWriteItemComment(
  documentId: string,
  itemId: string,
  change: ItemCommentChange,
  by: ItemPerson,
): Promise<ItemWriteAnswer | null> {
  return serializeOfflineWrite(async () => {
    let answer = null as ItemWriteAnswer | null;
    await offlineUpdateRecord(documentId, (rec) => {
      if (!rec || rec.trashedAt !== undefined) throw new ApiError('item comment', 404, 'not_found');
      const store = recordItemStore(rec);
      const item = store.items.find((i) => i.id === itemId);
      if (!item) throw new ApiError('item comment', 404, 'item_not_found');
      const result = applyItemComment(item, change, { now: Date.now(), by });
      if (!result.ok) {
        if (result.reason === 'unchanged') return undefined;
        throw new ApiError('item comment', COMMENT_STATUS[result.reason], result.reason);
      }
      const rev = store.rev + 1;
      const items = store.items.map((i) => (i.id === itemId ? result.item : i));
      answer = { upserts: [result.item], removed: [], rev };
      return { ...rec, items, itemsRev: rev, itemsNextKey: store.nextKey };
    });
    if (answer) debugLog('[items] items.offline.comment', { kind: change.kind });
    return answer;
  });
}
