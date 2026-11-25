// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3100/explorer/recent"}
// Opening an item, ahead (item-prefetch.ts), on livediagram's local router (:3100): the Explorer on the app's own
// address warms that app's editor, once per page, and never another site's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  itemRoute,
  pageAssets,
  prefetchItem,
  resetItemPrefetch,
  WARM_ASSETS_MAX,
  WARM_TIMEOUT_MS,
} from './item-prefetch';

const ORIGIN = 'http://localhost:3100';

// The editor's page as a static export names its code: scripts, a stylesheet, preloads of each kind.
const EDITOR_PAGE = `<!doctype html><html><head>
<link rel="stylesheet" href="/live/_next/static/css/app.css" data-precedence="next">
<link rel="preload" as="script" fetchpriority="low" href="/live/_next/static/chunks/webpack.js">
<link rel="preload" as="font" type="font/woff2" crossorigin="" href="/live/_next/static/media/inter.woff2">
<link rel="preload" as="image" href="/live/hero.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
<link rel="icon" href="/favicon.ico">
</head><body>
<script src="/live/_next/static/chunks/webpack.js" async=""></script>
<script src="/live/_next/static/chunks/main-app.js" async=""></script>
<script src="https://cdn.example/elsewhere.js"></script>
<script>self.__next_f=[]</script>
</body></html>`;

let fetchMock: ReturnType<typeof vi.fn>;
let links: HTMLLinkElement[];

// Every prefetch link the warm adds loads at once.
function autoLoadLinks() {
  links = [];
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    if (node instanceof HTMLLinkElement && node.rel === 'prefetch') {
      links.push(node);
      queueMicrotask(() => node.dispatchEvent(new Event(links.length % 2 ? 'load' : 'error')));
    }
    return append(node);
  });
}

beforeEach(() => {
  resetItemPrefetch();
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(EDITOR_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  autoLoadLinks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.head.querySelectorAll('link[rel="prefetch"]').forEach((l) => l.remove());
});

describe('itemRoute', () => {
  it('names the editor an item address on this origin opens', () => {
    expect(itemRoute(`${ORIGIN}/document/abc`)).toBe(`${ORIGIN}/document/`);
    expect(itemRoute('/project/p1?s=CODE#t=tab')).toBe(`${ORIGIN}/project/`);
  });

  it('skips another site, the Explorer’s own addresses and anything not one item', () => {
    expect(itemRoute('https://www.livediagram.app/document/abc')).toBeNull();
    expect(itemRoute('http://localhost:3200/project/p1')).toBeNull();
    expect(itemRoute('/explorer/recent')).toBeNull();
    expect(itemRoute('/document/')).toBeNull();
    expect(itemRoute('/document/a/b')).toBeNull();
    expect(itemRoute('http://[bad')).toBeNull();
  });
});

describe('pageAssets', () => {
  it('lists the page’s own code, styles and fonts, once each, with their crossorigin', () => {
    expect(pageAssets(EDITOR_PAGE, ORIGIN)).toEqual([
      { href: `${ORIGIN}/live/_next/static/chunks/webpack.js`, crossOrigin: null },
      { href: `${ORIGIN}/live/_next/static/chunks/main-app.js`, crossOrigin: null },
      { href: `${ORIGIN}/live/_next/static/css/app.css`, crossOrigin: null },
      { href: `${ORIGIN}/live/_next/static/media/inter.woff2`, crossOrigin: '' },
    ]);
  });

  it('stops at WARM_ASSETS_MAX and skips an address it cannot read', () => {
    const many = Array.from(
      { length: WARM_ASSETS_MAX + 20 },
      (_, i) => `<script src="/live/_next/c${i}.js"></script>`,
    ).join('');
    expect(pageAssets(many, ORIGIN)).toHaveLength(WARM_ASSETS_MAX);
    expect(pageAssets('<script src="http://[bad"></script>', ORIGIN)).toEqual([]);
  });
});

describe('prefetchItem', () => {
  it('fetches the editor page without cookies or the item’s share code, then its assets as prefetches', async () => {
    const done = prefetchItem(`${ORIGIN}/document/abc?s=CODE#t=tab`);
    expect(done).not.toBeNull();
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/document/abc`, {
      credentials: 'omit',
      priority: 'low',
    });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      `${ORIGIN}/live/_next/static/chunks/webpack.js`,
      `${ORIGIN}/live/_next/static/chunks/main-app.js`,
      `${ORIGIN}/live/_next/static/css/app.css`,
      `${ORIGIN}/live/_next/static/media/inter.woff2`,
    ]);
    // The font keeps its CORS mode, so the open's request matches what was fetched.
    expect(links[3]!.hasAttribute('crossorigin')).toBe(true);
    expect(links[0]!.hasAttribute('crossorigin')).toBe(false);
  });

  it('a 500-item library costs one warm per app: every later item is free', async () => {
    await prefetchItem(`${ORIGIN}/document/item-0`);
    for (let i = 1; i < 500; i++) expect(prefetchItem(`${ORIGIN}/document/item-${i}`)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Another app's editor on the same origin (none on a live host, but the route decides) asks its page, and its
    // assets already asked for are not asked again.
    await prefetchItem(`${ORIGIN}/project/p1`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(links).toHaveLength(4);
  });

  it('never fetches another site’s item', () => {
    expect(prefetchItem('https://www.liveplanner.app/project/p1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for nothing more when the page is not the editor’s HTML', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await prefetchItem(`${ORIGIN}/document/gone`);
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
    );
    await prefetchItem(`${ORIGIN}/project/p1`);
    fetchMock.mockResolvedValueOnce(new Response(null));
    await prefetchItem(`${ORIGIN}/design/d1`);
    expect(links).toEqual([]);
  });

  it('tries again on the next intent after a failed warm', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await prefetchItem(`${ORIGIN}/document/a`);
    const again = prefetchItem(`${ORIGIN}/document/b`);
    expect(again).not.toBeNull();
    await again;
    expect(links).toHaveLength(4);
  });

  it('counts a stalled warm as done after WARM_TIMEOUT_MS, freeing the Explorer’s slot', async () => {
    vi.useFakeTimers();
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    let settled = false;
    void prefetchItem(`${ORIGIN}/document/a`)!.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(WARM_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    // Still the app's warm: not asked for again.
    expect(prefetchItem(`${ORIGIN}/document/b`)).toBeNull();
  });
});
