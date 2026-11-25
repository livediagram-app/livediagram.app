'use client';

// Opening an item, ahead: the warm itself (item-prefetch.ts says when it runs). Its own module, loaded by the first
// intent that warms an editor, so the HTML parsing it needs (parseInert) never weighs on the Explorer's first load
// (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").

import { parseInert } from '@liveworkspace/trusted-types';

// The most assets one editor page may name before the rest are left to the open itself.
export const WARM_ASSETS_MAX = 80;

// Every asset already asked for, across warms.
const asked = new Set<string>();

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

/** Fetches the editor page at `href` and has the browser fetch the code, styles and fonts it names into its cache. */
export async function warm(href: string, origin: string): Promise<void> {
  const res = await fetch(href, { credentials: 'omit', priority: 'low' });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return;
  const assets = pageAssets(await res.text(), origin);
  await Promise.all(assets.map((a) => prefetchAsset(a.href, a.crossOrigin)));
}

/** For tests: forget every asset asked for. */
export function resetItemWarm() {
  asked.clear();
}
