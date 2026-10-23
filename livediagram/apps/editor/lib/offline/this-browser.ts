// This Browser for the Explorer on livediagram's own address (liveworkspace/docs/one-explorer.md "The Explorer on each
// app's address"): the canvases kept only in this browser live in IndexedDB, which the Explorer page (built by
// liveworkspace, served here) does not read. So the store keeps a small list of them, id, title and dates and never
// their content, in the shared localStorage key the Explorer reads (@liveworkspace/explorer/this-browser).
//
// Kept up to date from the store itself: each write notes its record (offline-store.ts), and the whole list is
// rebuilt from the records the id cache reads once per page load anyway (offline-ids.ts), so canvases written before
// the list existed, or by another tab, are listed too.

import {
  dropThisBrowserItem,
  putThisBrowserItem,
  writeThisBrowser,
  type ThisBrowserItem,
} from '@liveworkspace/explorer/this-browser';
import { localOpensOf } from './offline-opens';
import type { OfflineDocumentRecord } from './offline-store';

const APP = 'livediagram';

/** The few fields the Explorer lists a canvas by. */
export function thisBrowserItemOf(rec: OfflineDocumentRecord): ThisBrowserItem {
  return {
    id: rec.id,
    title: rec.name,
    createdAt: rec.createdAt,
    updatedAt: rec.savedAt,
    lastOpenedAt: localOpensOf(rec.opens)?.lastOpenedAt ?? null,
    trashedAt: rec.trashedAt ?? null,
    favourite: rec.favourite === true,
  };
}

/** The whole list, from every record in the store (trashed ones too: the Explorer's Trash lists them). */
export function publishThisBrowser(recs: readonly OfflineDocumentRecord[]): void {
  writeThisBrowser(APP, recs.map(thisBrowserItemOf));
}

/** One write's outcome: the record as it now is, gone, or untouched. */
export function noteThisBrowser(
  id: string,
  after: OfflineDocumentRecord | 'delete' | undefined,
): void {
  if (after === 'delete') dropThisBrowserItem(APP, id);
  else if (after) putThisBrowserItem(APP, thisBrowserItemOf(after));
}
