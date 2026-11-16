// Where a live embed's item lives (liveworkspace/docs/specs/004-index/live-embeds.md "The frame", "Making one"): the
// item's app's origin as this page sees it (a staging page's staging app, a dev server's local port), the item's own
// address for Open, and the item a pasted share link names. Pure, so each is tested alone.
import {
  APP_ITEMS,
  appOfAnyOrigin,
  appOfSite,
  siteHrefFrom,
  siteOfApp,
  type AppName,
} from '@liveworkspace/sites';
import { isLiveEmbedApp, type LiveEmbedApp } from '@liveworkspace/element-model/live-item';

/** The item's app's origin, from a page on `host` (its staging site from a staging page). */
export function liveEmbedOrigin(app: LiveEmbedApp, host: string): string {
  const site = siteOfApp(app);
  return new URL(siteHrefFrom(site, site.url, host)).origin;
}

/** The item's own address in its own app: both Opens go there. */
export function liveEmbedItemHref(app: LiveEmbedApp, itemId: string, host: string): string {
  return `${liveEmbedOrigin(app, host)}${APP_ITEMS[app].itemPath}${encodeURIComponent(itemId)}`;
}

// A share code as the index mints them, and the most a pasted link may run to.
const SHARE_CODE = /^[A-Za-z0-9_-]{1,128}$/;
const PASTE_MAX = 2048;

/** The app and code a pasted share link of one of the target apps names, else null. A plain parse: one URL, its
 *  origin an app's (any environment), its path the app's share page, its `s` the code. */
export function parseLiveEmbedShareLink(text: string): { app: LiveEmbedApp; code: string } | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > PASTE_MAX) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const site = appOfAnyOrigin(url.origin);
  const app: AppName | null = site ? appOfSite(site) : null;
  if (!app || !isLiveEmbedApp(app)) return null;
  const sharePath = APP_ITEMS[app].sharePath;
  const [path, query] = sharePath.split('?');
  if (url.pathname !== path || !query?.endsWith('=')) return null;
  const code = url.searchParams.get(query.slice(0, -1));
  return code && SHARE_CODE.test(code) ? { app, code } : null;
}
