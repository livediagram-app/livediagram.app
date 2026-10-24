'use client';

// Take Offline and Sync in the Explorer on an app's own address (liveworkspace/docs/one-explorer.md "The Explorer on
// each app's address"). Moving an item into this browser, or back into the account, is the app's own code: only it
// can write its offline store. So the Explorer offers the verbs and hands over to the app's This Browser page
// (`?convert=…&item=…`, @liveworkspace/explorer/this-browser), which confirms and runs the move, then lists the result.
// Only where the registry says the app's page does (`offlineConversions`), and never on liveworkspace.app, whose
// origin can't reach the app's storage.

import type { ItemMenuHost, ThisBrowserItem } from '@liveworkspace/explorer';
import { thisBrowserConvertHref } from '@liveworkspace/explorer/this-browser';
import type { Item } from '@liveworkspace/index-client';
import { lucideGlyph } from '@livediagram/ui';
import { lucideDownload } from '@liveworkspace/icons/lucide';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';

const TakeOfflineIcon = lucideGlyph(lucideDownload, 16);

/** The app's This Browser page when it converts, else null. */
function convertingPage(host: AppName | null): string | null {
  if (!host) return null;
  const items = APP_ITEMS[host];
  return items.offlineConversions ? items.offlinePath : null;
}

/** Take Offline on the menu of each of the app's own items the person can edit and holds themselves (not one reached
 *  through a link). Undefined where the app converts none. */
export function offlineItemMenu(host: AppName | null): ItemMenuHost | undefined {
  const page = convertingPage(host);
  if (!page) return undefined;
  return (item: Item) =>
    item.app !== host || item.sharedVia || item.access !== 'edit'
      ? []
      : [
          {
            id: 'take-offline',
            label: 'Take Offline',
            icon: <TakeOfflineIcon />,
            onSelect: () =>
              window.location.assign(thisBrowserConvertHref(page, 'take-offline', item.id)),
          },
        ];
}

/** Sync on each of This Browser's rows, for a person signed in (a guest has no account to move it to). */
export function offlineSyncHref(
  host: AppName | null,
  signedIn: boolean,
): ((item: ThisBrowserItem) => string) | undefined {
  const page = convertingPage(host);
  if (!page || !signedIn) return undefined;
  return (item) => thisBrowserConvertHref(page, 'sync', item.id);
}
