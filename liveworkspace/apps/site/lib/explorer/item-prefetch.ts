'use client';

// Opening an item, ahead (liveworkspace/docs/specs/004-index/one-explorer.md "Cost and performance", Opening an
// item ahead): the Explorer's `prefetchItem` on liveworkspace.app and on every app's address. When a pointer rests
// on an item's link (or focus reaches it), the Explorer asks; this fetches the app's editor page for that address
// (the same page for every item of the app: its HTML carries the first render's payload) and has the browser fetch
// the code and styles that page names into its cache, so the open that follows loads them from there.
//
// Only on the page's own origin: the Explorer on an app's address opening that app's items. Another site's address
// (every item on liveworkspace.app, another app's item on an app's address) is skipped, since the browser keeps a
// separate cache per site and the open would never read what was fetched. Once per app per page: after the first
// warm, a later intent on any of that app's items costs nothing. The editor page is fetched without cookies and is
// the same for every item, so a prefetch says nothing about an item the reader could not open; the item's own data
// (fetched by the editor with the reader's token, never cacheable) is not prefetched.

import { APP_ITEMS, APP_NAMES } from '@liveworkspace/sites';

// A warm counts as done after this long, so a stalled request never holds the Explorer's one prefetch slot.
export const WARM_TIMEOUT_MS = 8000;

// Each app's warm on this page, by its editor's route (origin and item path), in flight or done.
const warmed = new Map<string, Promise<void>>();

/** The editor route an item address opens (its origin and the app's item path), or null for an address that is
 *  not an item's on this page's own origin. */
export function itemRoute(href: string, page: Location = window.location): string | null {
  let url: URL;
  try {
    url = new URL(href, page.href);
  } catch {
    return null;
  }
  if (url.origin !== page.origin) return null;
  for (const app of APP_NAMES) {
    const path = APP_ITEMS[app].itemPath;
    if (!url.pathname.startsWith(path)) continue;
    const id = url.pathname.slice(path.length);
    if (id && !id.includes('/')) return `${url.origin}${path}`;
  }
  return null;
}

const timeout = () => new Promise<void>((resolve) => setTimeout(resolve, WARM_TIMEOUT_MS));

/** The Explorer's `prefetchItem`: warms the editor an item's address opens, once per app per page. Null when there
 *  is nothing to fetch (another site's address, or that editor already warmed). */
export function prefetchItem(href: string): Promise<void> | null {
  const route = itemRoute(href);
  if (!route || warmed.has(route)) return null;
  const origin = window.location.origin;
  // The page alone: a share code or a deep link's place means nothing to it.
  const page = new URL(href, origin);
  page.search = '';
  page.hash = '';
  // The warm's code (and the HTML parsing it needs) loads with the first warm, never with the Explorer.
  const running = Promise.race([
    import('./item-warm').then((m) => m.warm(page.href, origin)),
    timeout(),
  ]).catch(() => {
    // A failed warm is tried again by the next intent; the open itself never depended on it.
    warmed.delete(route);
  });
  warmed.set(route, running);
  return running;
}

/** For tests: forget every warm. */
export function resetItemPrefetch() {
  warmed.clear();
}
