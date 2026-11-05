'use client';

// Take Offline and Sync in the Explorer on an app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The Explorer on
// each app's address"). Moving an item into this browser, or back into the account, is the app's own code: only it
// can write its offline store. So the Explorer offers the verbs and hands over to the app's editor, at the item's own
// address (`?convert=…&item=…`, @liveworkspace/explorer/this-browser), which confirms and runs the move. A request
// that reaches This Browser's view (`handOverHref`) goes on there too. Only where the registry says the editor does
// (`offlineConversions`), and never on liveworkspace.app, whose origin can't reach the app's storage.

import type { ItemMenuHost, ThisBrowserItem } from '@liveworkspace/explorer';
import {
  markThisBrowserDeleteConfirmed,
  thisBrowserConvertHref,
  type ThisBrowserConversion,
} from '@liveworkspace/explorer/this-browser';
import type { Item } from '@liveworkspace/index-client';
import { lucideGlyph } from '@livediagram/ui';
import { lucideDownload } from '@liveworkspace/icons/lucide';
import { removeThisBrowserRecord } from '@liveworkspace/explorer/this-browser-record';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';

const TakeOfflineIcon = lucideGlyph(lucideDownload, 16);

/** Where the app's editor runs a conversion on one item (its own address there) when it converts, else null. */
export function offlineHandOver(
  host: AppName | null,
): ((conversion: ThisBrowserConversion, id: string) => string) | null {
  if (!host || !APP_ITEMS[host].offlineConversions) return null;
  const { itemPath } = APP_ITEMS[host];
  return (conversion, id) =>
    thisBrowserConvertHref(`${itemPath}${encodeURIComponent(id)}`, conversion, id);
}

/** Take Offline on the menu of each of the app's own items the person can edit and holds themselves (not one reached
 *  through a link). Undefined where the app converts none. */
export function offlineItemMenu(host: AppName | null): ItemMenuHost | undefined {
  const handOver = offlineHandOver(host);
  if (!handOver) return undefined;
  return (item: Item) =>
    item.app !== host || item.sharedVia || item.access !== 'edit'
      ? []
      : [
          {
            id: 'take-offline',
            label: 'Take Offline',
            icon: <TakeOfflineIcon />,
            onSelect: () => window.location.assign(handOver('take-offline', item.id)),
          },
        ];
}

/** Sync on each of This Browser's rows, for a person signed in (a guest has no account to move it to). */
export function offlineSyncHref(
  host: AppName | null,
  signedIn: boolean,
): ((item: ThisBrowserItem) => string) | undefined {
  const handOver = offlineHandOver(host);
  if (!handOver || !signedIn) return undefined;
  return (item) => handOver('sync', item.id);
}

/** Delete on each of This Browser's rows, for anyone, once the Explorer has asked (its `delete-local` dialog): in
 *  place, the page deleting the record from the app's offline store itself, so the person stays where they were and the
 *  item leaves the list there. Where it can't reach the record (`unreachable`), it falls back to the hand-over: it notes
 *  that the Explorer asked for the editor in this tab and opens the item there, which deletes it without asking again
 *  and comes back to `/explorer/offline`. Undefined where the app converts none. */
export function offlineRemove(
  host: AppName | null,
  assign: (href: string) => void = (href) => window.location.assign(href),
  removeRecord: typeof removeThisBrowserRecord = removeThisBrowserRecord,
): ((item: ThisBrowserItem) => Promise<void>) | undefined {
  const handOver = offlineHandOver(host);
  if (!handOver || !host) return undefined;
  return async (item) => {
    if ((await removeRecord(host, item.id)) === 'removed') return;
    markThisBrowserDeleteConfirmed(item.id);
    assign(handOver('delete', item.id));
  };
}
