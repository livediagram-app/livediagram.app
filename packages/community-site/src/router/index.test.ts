import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityPostFixture } from '@liveworkspace/community/testing';
import { isCommunityPath, routeCommunity, type CommunityRouteOptions } from './index';
import { API_TIMEOUT_MS } from './post-head';

// HTMLRewriter is a Workers runtime global. This stand-in runs every handler against one recording element per
// selector and answers what was set, so a test reads exactly what the step wrote into the head.
type Edits = Record<string, { attrs: Record<string, string>; inner?: string; appended: string[] }>;
class RecordingRewriter {
  handlers: [string, { element(el: unknown): void }][] = [];
  on(selector: string, handler: { element(el: unknown): void }) {
    this.handlers.push([selector, handler]);
    return this;
  }
  transform(response: Response): Response {
    const edits: Edits = {};
    for (const [selector, handler] of this.handlers) {
      const edit = (edits[selector] ??= { attrs: {}, appended: [] });
      handler.element({
        setAttribute: (name: string, value: string) => void (edit.attrs[name] = value),
        setInnerContent: (content: string) => void (edit.inner = content),
        append: (content: string) => void edit.appended.push(content),
      });
    }
    return new Response(JSON.stringify(edits), {
      status: response.status,
      headers: response.headers,
    });
  }
}

const SHELL = '<html><head><title>Community | liveworkspace</title></head><body></body></html>';

// livediagram's router: the step bound to its app, with liveworkspace.app's pages behind `forward`, and the Community
// service answering `api` for each path it is asked (always for livediagram.app's posts), or unreachable without one.
function makeRoute(api?: (path: string, init?: RequestInit) => Promise<Response> | Response) {
  const forwarded: string[] = [];
  const options: CommunityRouteOptions = {
    site: {
      app: 'livediagram.app',
      siteUrl: 'https://www.livediagram.app',
      product: 'livediagram',
      nouns: 'canvases',
    },
    forward: (request) => {
      const url = new URL(request.url);
      forwarded.push(`${url.pathname}${url.search}`);
      return Promise.resolve(new Response(SHELL, { headers: { 'content-type': 'text/html' } }));
    },
  };
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!api) throw new Error('unreachable');
    expect(url.origin).toBe('https://www.liveworkspace.app');
    expect(url.searchParams.get('app')).toBe('livediagram.app');
    return api(url.pathname, init);
  });
  return { options, forwarded };
}

const get = (path: string, options: CommunityRouteOptions, method = 'GET') =>
  routeCommunity(new Request(`https://www.livediagram.app${path}`, { method }), options);

beforeEach(() => {
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Community step: which paths', () => {
  it('takes /community, anything under it and its payloads, and nothing else', () => {
    for (const path of ['/community', '/community/', '/community/post', '/community.txt']) {
      expect(isCommunityPath(path)).toBe(true);
    }
    for (const path of ['/', '/communityx', '/help/community', '/explorer']) {
      expect(isCommunityPath(path)).toBe(false);
    }
    expect(get('/explorer', makeRoute().options)).toBeNull();
  });

  it("hands every other Community path to liveworkspace.app's pages as it is", async () => {
    const { options, forwarded } = makeRoute();
    expect(await (await get('/community/', options))!.text()).toBe(SHELL);
    await get('/_liveworkspace/_next/x.js', options);
    await get('/community/post.txt?id=p1', options);
    expect(forwarded).toEqual(['/community/', '/community/post.txt?id=p1']);
  });
});

describe('the Community step: the gallery', () => {
  it("makes liveworkspace.app's All Apps head the app's own Community", async () => {
    const { options } = makeRoute();
    const edits = (await (await get('/community', options))!.json()) as Edits;
    expect(edits.title!.inner).toBe('Community | livediagram');
    expect(edits['link[rel="canonical"]']!.attrs.href).toBe(
      'https://www.livediagram.app/community',
    );
    expect(edits['meta[property="og:url"]']!.attrs.content).toBe(
      'https://www.livediagram.app/community',
    );
    expect(edits['meta[property="og:site_name"]']!.attrs.content).toBe('livediagram Community');
    expect(edits['meta[name="description"]']!.attrs.content).toMatch(
      /^Canvases people are proud of/,
    );
  });
});

describe('the Community step: a post page', () => {
  it("fills the shell's head with the post the id names", async () => {
    const seen: string[] = [];
    const { options, forwarded } = makeRoute((path) => {
      seen.push(path);
      return Response.json({ post: communityPostFixture({ id: 'p1' }), related: [] });
    });
    const res = (await get('/community/post?id=p1', options))!;
    expect(forwarded).toEqual(['/community/post?id=p1']);
    expect(seen).toEqual(['/api/community/posts/p1']);
    expect(res.status).toBe(200);
    const edits = (await res.json()) as Edits;
    expect(edits.title!.inner).toBe('Payments Platform | livediagram Community');
    expect(edits['meta[name="description"]']!.attrs.content).toBe(
      'How our payment services talk to each other.',
    );
    expect(edits['meta[property="og:title"]']!.attrs.content).toBe(
      'Payments Platform | livediagram Community',
    );
    const head = edits.head!.appended.join('');
    expect(head).toContain(
      '<link rel="canonical" href="https://www.livediagram.app/community/post?id=p1"/>',
    );
    expect(head).toContain(
      '<meta property="og:url" content="https://www.livediagram.app/community/post?id=p1"/>',
    );
    expect(head).toContain('<script type="application/ld+json">');
  });

  it('answers 404 for a post that does not exist or is hidden, keeping the friendly page', async () => {
    const { options } = makeRoute(() => new Response('', { status: 404 }));
    const res = (await get('/community/post?id=gone', options))!;
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(SHELL);
  });

  it('serves the shell unchanged when the service fails or is unreachable', async () => {
    for (const make of [
      () => makeRoute(() => new Response('', { status: 500 })).options,
      () => makeRoute(() => Promise.reject(new Error('down'))).options,
      () => makeRoute().options,
    ]) {
      const res = (await get('/community/post?id=p1', make()))!;
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SHELL);
    }
  });

  it('gives the api a bounded time before serving the shell', async () => {
    let signal: AbortSignal | undefined;
    const { options } = makeRoute((_path, init) => {
      signal = init?.signal ?? undefined;
      return Response.json({ post: communityPostFixture(), related: [] });
    });
    await get('/community/post?id=p1', options);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(API_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it('leaves the shell alone with no id, for a HEAD request, and for a redirect', async () => {
    const api = vi.fn(() => Response.json({}));
    const { options } = makeRoute(api);
    expect(await (await get('/community/post', options))!.text()).toBe(SHELL);
    expect((await get('/community/post?id=p1', options, 'HEAD'))!.status).toBe(200);
    const moved = await routeCommunity(
      new Request('https://www.livediagram.app/community/post/?id=p1'),
      {
        ...options,
        forward: () =>
          Promise.resolve(
            new Response(null, { status: 308, headers: { Location: '/community/post?id=p1' } }),
          ),
      },
    );
    expect(moved!.status).toBe(308);
    expect(api).not.toHaveBeenCalled();
  });
});

describe('the Community step: the sitemap', () => {
  it('lists every public post the api names, at its canonical address', async () => {
    const { options, forwarded } = makeRoute((path) => {
      expect(path).toBe('/api/community/sitemap');
      return Response.json({ posts: [{ id: 'p1', updatedAt: Date.UTC(2026, 9, 1) }] });
    });
    const res = (await get('/community/sitemap.xml', options))!;
    expect(forwarded).toEqual([]);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await res.text()).toContain(
      '<loc>https://www.livediagram.app/community/post?id=p1</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod>',
    );
  });

  it('is empty when the Community is switched off', async () => {
    const { options } = makeRoute(() => new Response('', { status: 404 }));
    const res = (await get('/community/sitemap.xml', options))!;
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain('<url>');
  });

  it('asks crawlers to come back later when the api is unavailable', async () => {
    const res = (await get('/community/sitemap.xml', makeRoute().options))!;
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('3600');
  });
});
