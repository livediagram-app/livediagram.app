'use client';

// The Explorer's Offline (liveworkspace/docs/specs/010-site/site.md "The Explorer"): on an app's own address, the
// app's items kept only in this browser, with its Sync, hand-over and Delete, and Take Offline on its own items; on
// liveworkspace.app, which can't read them, nothing (Offline shows only as a Space that holds something).
import { useMemo } from 'react';
import { useThisBrowserList, type ThisBrowserHost } from '@liveworkspace/explorer';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import {
  offlineHandOver,
  offlineItemMenu,
  offlineRemove,
  offlineSyncHref,
} from '@/lib/explorer/offline-moves';

export function useExplorerThisBrowser(host: AppName | null, signedIn: boolean) {
  // Offline on the app's own address: the app's list, read here and heard as it changes.
  const local = useThisBrowserList(host);
  const syncHref = useMemo(() => offlineSyncHref(host, signedIn), [host, signedIn]);
  const handOverHref = useMemo(() => offlineHandOver(host), [host]);
  const remove = useMemo(() => offlineRemove(host), [host]);
  const thisBrowser: ThisBrowserHost | null = useMemo(
    () =>
      host
        ? {
            items: local,
            itemHref: (item) => `${APP_ITEMS[host].itemPath}${encodeURIComponent(item.id)}`,
            helpHref: '/help/privacy-and-security/offline-mode/',
            ...(syncHref ? { syncHref } : {}),
            ...(handOverHref ? { handOverHref } : {}),
            ...(remove ? { remove } : {}),
          }
        : null,
    [host, local, syncHref, handOverHref, remove],
  );
  // Take Offline on the app's own items, handed to the item in the app's editor.
  const itemMenu = useMemo(() => offlineItemMenu(host), [host]);

  return { thisBrowser, itemMenu };
}
