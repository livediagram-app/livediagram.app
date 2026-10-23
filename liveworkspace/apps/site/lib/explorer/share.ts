'use client';

// The Share dialog's extras on liveworkspace.app (@liveworkspace/explorer `ShareHost`), for every app's items without
// any of the apps' code: each app says in the sites registry (`APP_ITEMS[app].share`) where it serves a pass's embed
// and live image, where an item's tabs are read (so a pass can open one), and its help articles on sharing. The tabs
// are read once, when the dialog opens, with the person's workspace token (and the item's share code when it was
// reached through a link), as the previews are.

import type { ShareHandOver, ShareHelpHref, ShareHost } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import { APP_ITEMS, isAppName, siteOfApp, type AppName } from '@liveworkspace/sites';
import { trackShare } from './telemetry';
import { workspaceToken } from './token';

const fill = (path: string, values: Record<string, string>) =>
  path.replace(/:(code|id)\b/g, (_, key: string) => encodeURIComponent(values[key] ?? ''));

/** An app's embed and live image for its passes, or undefined when it serves neither. */
export function handOverFor(app: AppName): ShareHandOver | undefined {
  const { share } = APP_ITEMS[app];
  const url = siteOfApp(app).url;
  if (!share.embedPath && !share.liveImagePath) return undefined;
  return {
    embedUrl: share.embedPath
      ? (link) => `${url}${fill(share.embedPath!, { code: link.code })}`
      : undefined,
    liveImageUrl: share.liveImagePath
      ? (link, tabId) => {
          const base = `${url}${fill(share.liveImagePath!, { code: link.code })}`;
          return tabId ? `${base}?tab=${encodeURIComponent(tabId)}` : base;
        }
      : undefined,
    liveImageAlt: share.liveImageAlt,
  };
}

/** An item's tabs, as its app's API answers the workspace token; none when the app keeps them to itself or the read
 *  fails (a pass then opens every tab). */
export async function loadTabsOf(
  item: Pick<Item, 'app' | 'id' | 'sharedVia'>,
  doFetch: typeof fetch = fetch,
): Promise<{ id: string; name: string }[]> {
  if (!isAppName(item.app)) return [];
  const { tabsPath, tabsKey } = APP_ITEMS[item.app].share;
  if (!tabsPath) return [];
  try {
    const token = await workspaceToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (item.sharedVia) headers.set('X-Share-Code', item.sharedVia);
    const res = await doFetch(`${siteOfApp(item.app).url}${fill(tabsPath, { id: item.id })}`, {
      headers,
      credentials: 'omit',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, { tabs?: unknown } | undefined>;
    const tabs = body[tabsKey]?.tabs;
    if (!Array.isArray(tabs)) return [];
    return tabs.flatMap((tab: unknown) => {
      const t = tab as { id?: unknown; name?: unknown };
      return typeof t?.id === 'string'
        ? [{ id: t.id, name: typeof t.name === 'string' ? t.name : '' }]
        : [];
    });
  } catch {
    return [];
  }
}

/** The app's help articles on sharing, in its own help centre. */
export function shareHelpHrefFor(app: AppName): ShareHelpHref {
  const { help } = APP_ITEMS[app].share;
  const url = siteOfApp(app).url;
  return (article) => `${url}/help/${help[article]}/`;
}

/** The Share dialog's extras for the page's app (its help), and per item for every app's (tabs, embed, live image). */
export function shareHostFor(app: AppName): ShareHost {
  return {
    loadTabs: (item) => loadTabsOf(item),
    handOver: (item) => (isAppName(item.app) ? handOverFor(item.app) : undefined),
    helpHref: shareHelpHrefFor(app),
    onTelemetry: trackShare,
  };
}
