'use client';

// The Share dialog's extras on liveworkspace.app (@liveworkspace/explorer `ShareHost`), for every app's items without
// any of the apps' code: each app says in the sites registry (`APP_ITEMS[app].share`) where it serves a pass's embed
// and live image, where an item's tabs are read (so a pass can open one), and its help articles on sharing. The tabs
// are read once, when the dialog opens, with the person's workspace token (and the item's share code when it was
// reached through a link), as the previews are: the tabs alone where the app serves them, never the whole item.

import { isCommunityApp } from '@liveworkspace/community';
import { COMMUNITY_APP_WORDS, communityOwnerClient } from '@liveworkspace/community-ui/share';
import type {
  CommunityShareInput,
  ShareHandOver,
  ShareHelpHref,
  ShareHost,
} from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import { APP_ITEMS, APP_NAMES, isAppName, siteOfApp, type AppName } from '@liveworkspace/sites';
import { appOrigin, pageApp } from './page-app';
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

/** An item's tabs, as its app's API answers the workspace token (`{ tabs }`). None when the app keeps them to itself
 *  or the read fails (a pass then opens every tab). */
export async function loadTabsOf(
  item: Pick<Item, 'app' | 'id' | 'sharedVia'>,
  doFetch: typeof fetch = fetch,
): Promise<{ id: string; name: string }[]> {
  if (!isAppName(item.app)) return [];
  const { tabsPath } = APP_ITEMS[item.app].share;
  if (!tabsPath) return [];
  try {
    const token = await workspaceToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (item.sharedVia) headers.set('X-Share-Code', item.sharedVia);
    const res = await doFetch(`${appOrigin(item.app)}${fill(tabsPath, { id: item.id })}`, {
      headers,
      credentials: 'omit',
    });
    if (!res.ok) return [];
    const { tabs } = (await res.json()) as { tabs?: unknown };
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

/** The apps whose items have a Community tab here: each with a Community and an owner route to reach it through
 *  (`APP_ITEMS[app].share.communityPath`). The others' come with their Communities. */
export const COMMUNITY_SHARE_APPS: readonly AppName[] = APP_NAMES.filter(
  (app) => APP_ITEMS[app].share.communityPath !== null && isCommunityApp(APP_ITEMS[app].site),
);

/** The apps the Explorer here can offer the Community tab for: on an app's own address only that app (its token is
 *  that app's alone), on liveworkspace.app every app with one. */
export function communityShareAppsHere(here: AppName | null): readonly AppName[] {
  if (!here) return COMMUNITY_SHARE_APPS;
  return COMMUNITY_SHARE_APPS.includes(here) ? [here] : [];
}

/** The signed-in account the Explorer asks as, for the Community tab: its `sub` and the name its listings show. */
export type ShareAccount = { id: string; name: string | null };

// The listing's author colour, which the account doesn't choose here.
const AUTHOR_COLOUR = '#64748b';

/** An item's Community tab (liveworkspace/docs/specs/007-community/community.md "The Share dialog's Community tab"):
 *  for the account's own items of an app with a Community, through the app's owner route with the workspace token.
 *  On an app's own address the token is that app's alone, so another app's items get none. */
export function communityShareOf(
  item: Pick<Item, 'app' | 'id' | 'title' | 'ownerId'>,
  account: ShareAccount | null,
  communityOn: boolean,
  signInHref: string,
  doFetch?: typeof fetch,
): CommunityShareInput | undefined {
  if (!account || !communityOn || item.ownerId !== account.id || !isAppName(item.app)) {
    return undefined;
  }
  const app = item.app;
  const here = pageApp();
  if (here && here !== app) return undefined;
  const { communityPath } = APP_ITEMS[app].share;
  const communityApp = APP_ITEMS[app].site;
  if (!communityPath || !isCommunityApp(communityApp)) return undefined;
  const url = siteOfApp(app).url;
  return {
    host: {
      app: communityApp,
      words: COMMUNITY_APP_WORDS[communityApp],
      client: communityOwnerClient({
        app: communityApp,
        url: `${appOrigin(app)}${fill(communityPath, { id: item.id })}`,
        token: workspaceToken,
        fetch: doFetch,
      }),
      // The post's page in the app's own Community.
      postHref: (postId) => `${url}/community/post/?id=${encodeURIComponent(postId)}`,
    },
    ownerId: account.id,
    documentName: item.title,
    signedIn: true,
    communityOn,
    signInHref,
    author: { name: account.name || 'You', color: AUTHOR_COLOUR },
  };
}

/** The Share dialog's extras for the page's app (its help), and per item for every app's (tabs, embed, live image,
 *  and the Community tab for the signed-in account's own items while the Community is on). */
export function shareHostFor(
  app: AppName,
  account: ShareAccount | null = null,
  communityOn: (app: AppName) => boolean = () => false,
  signInHref = '',
): ShareHost {
  return {
    community: (item) =>
      isAppName(item.app)
        ? communityShareOf(item, account, communityOn(item.app), signInHref)
        : undefined,
    loadTabs: (item) => loadTabsOf(item),
    handOver: (item) => (isAppName(item.app) ? handOverFor(item.app) : undefined),
    helpHref: shareHelpHrefFor(app),
    onTelemetry: trackShare,
  };
}
