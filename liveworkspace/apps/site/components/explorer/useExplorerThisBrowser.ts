'use client';

// The Explorer's This Browser (liveworkspace/docs/specs/010-site/site.md "The Explorer"): on an app's own address, the
// app's items kept only in this browser, with its Sync, hand-over and Delete, and Take Offline on its own items; on
// liveworkspace.app, which can't read them, a sidebar link to the app's own offline view.
import { useMemo } from 'react';
import {
  SIDEBAR_LABELS,
  useThisBrowserList,
  type SidebarLink,
  type ThisBrowserHost,
} from '@liveworkspace/explorer';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { offlineHref } from '@/lib/explorer/host';
import {
  offlineHandOver,
  offlineItemMenu,
  offlineRemove,
  offlineSyncHref,
} from '@/lib/explorer/offline-moves';

export function useExplorerThisBrowser(host: AppName | null, app: AppName, signedIn: boolean) {
  // This Browser on the app's own address: the app's list, read here and heard as it changes.
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

  // This Browser on liveworkspace.app, which can't read it: a link to the app's own offline view.
  const sidebarLinks: SidebarLink[] = useMemo(() => {
    if (host) return [];
    const href = offlineHref(app);
    return href
      ? [
          {
            id: 'this-browser',
            label: SIDEBAR_LABELS.thisBrowser,
            href,
            description: `${APP_ITEMS[app].nouns} kept only in this browser, in ${APP_ITEMS[app].site.replace(/\.app$/, '')}`,
            icon: 'browser',
          },
        ]
      : [];
  }, [app, host]);

  return { thisBrowser, itemMenu, sidebarLinks };
}
