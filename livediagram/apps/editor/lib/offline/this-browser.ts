// This Browser for the Explorer on livediagram's own address (liveworkspace/docs/one-explorer.md "The Explorer on each
// app's address"): the canvases kept only in this browser live in IndexedDB, which the Explorer page does not read, so
// the store keeps the shared list of them (@liveworkspace/explorer/this-browser). Each write notes its record
// (offline-store.ts), and the id cache's one read of every record per page load rebuilds it (offline-ids.ts), so
// canvases written before the list existed, or by another tab, are listed too.

import { thisBrowserPublisher } from '@liveworkspace/explorer/this-browser';
import { inboxSnapshot } from './inbox-snapshot';
import { localOpensOf } from './offline-opens';
import type { OfflineDocumentRecord } from './offline-store';

const list = thisBrowserPublisher<OfflineDocumentRecord>(
  'livediagram',
  (opens) => localOpensOf(opens)?.lastOpenedAt ?? null,
  // Each write may change the Inbox's rows too: the snapshot is worked out again once the store is quiet.
  () => inboxSnapshot.schedule(),
);

export const thisBrowserItemOf = list.itemOf;
export const publishThisBrowser = list.publish;
export const noteThisBrowser = list.note;
