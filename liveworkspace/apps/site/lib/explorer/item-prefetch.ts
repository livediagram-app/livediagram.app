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

import { parseInert } from '@liveworkspace/trusted-types';
import { APP_ITEMS, APP_NAMES } from '@liveworkspace/sites';

// The most assets one editor page may name before the rest are left to the open itself.
export const WARM_ASSETS_MAX = 80;
// A warm counts as done after this long, so a stalled request never holds the Explorer's one prefetch slot.
export const WARM_TIMEOUT_MS = 8000;

// Each app's warm on this page, by its editor's route (origin and item path), in flight or done.
const warmed = new Map<string, Promise<void>>();
// Every asset already asked for, across warms.
const asked = new Set<string>();

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

/** The scripts, styles and fonts an editor page names on `origin`, at most WARM_ASSETS_MAX, each with the
 *  `crossorigin` it is loaded with (a font asked for with another mode is a cache miss). */
export function pageAssets(
  html: string,
  origin: string,
): { href: string; crossOrigin: string | null }[] {
  const doc = parseInert(html, 'text/html');
  const found: { href: string; crossOrigin: string | null }[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null, crossOrigin: string | null) => {
    if (!raw || found.length >= WARM_ASSETS_MAX) return;
    let url: URL;
    try {
      url = new URL(raw, `${origin}/`);
    } catch {
      return;
    }
    if (url.origin !== origin || seen.has(url.href)) return;
    seen.add(url.href);
    found.push({ href: url.href, crossOrigin });
  };
  for (const el of doc.querySelectorAll('script[src]'))
    add(el.getAttribute('src'), el.getAttribute('crossorigin'));
  for (const el of doc.querySelectorAll(
    'link[rel~="stylesheet"][href], link[rel~="preload"][href], link[rel~="modulepreload"][href]',
  )) {
    const as = el.getAttribute('as');
    // A preload of an image or a fetch is the page's own business; the code, styles and fonts are what an open waits on.
    if (el.matches('link[rel~="preload"]') && as !== 'script' && as !== 'style' && as !== 'font')
      continue;
    add(el.getAttribute('href'), el.getAttribute('crossorigin'));
  }
  return found;
}

// One asset into the browser's cache at low priority, settled on load, error or the timeout.
function prefetchAsset(href: string, crossOrigin: string | null): Promise<void> {
  if (asked.has(href)) return Promise.resolve();
  asked.add(href);
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    if (crossOrigin !== null) link.crossOrigin = crossOrigin;
    link.href = href;
    const done = () => resolve();
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
    document.head.appendChild(link);
  });
}

async function warm(href: string, origin: string): Promise<void> {
  const res = await fetch(href, { credentials: 'omit', priority: 'low' });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return;
  const assets = pageAssets(await res.text(), origin);
  await Promise.all(assets.map((a) => prefetchAsset(a.href, a.crossOrigin)));
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
  const running = Promise.race([warm(page.href, origin), timeout()]).catch(() => {
    // A failed warm is tried again by the next intent; the open itself never depended on it.
    warmed.delete(route);
  });
  warmed.set(route, running);
  return running;
}

/** For tests: forget every warm. */
export function resetItemPrefetch() {
  warmed.clear();
  asked.clear();
}
