// This Browser for the Explorer on livedesign's own address (liveworkspace/docs/one-explorer.md "The Explorer on each
// app's address"): the designs kept only in this browser live in IndexedDB, which the Explorer page does not read, so
// the store keeps the shared list of them (@liveworkspace/explorer/this-browser). Each write notes its record
// (offline-store.ts), and the id cache's one read of every record per page load rebuilds it (offline-ids.ts).

import { thisBrowserPublisher } from '@liveworkspace/explorer/this-browser';
import { localOpensOf } from './offline-opens';
import type { OfflineDesignRecord } from './offline-store';

const list = thisBrowserPublisher<OfflineDesignRecord>(
  'livedesign',
  (opens) => localOpensOf(opens)?.lastOpenedAt ?? null,
);

export const thisBrowserItemOf = list.itemOf;
export const publishThisBrowser = list.publish;
export const noteThisBrowser = list.note;
