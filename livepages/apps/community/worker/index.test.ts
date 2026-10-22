import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityPostFixture } from '@livepages/api-schema/testing';
import worker, { type Env } from './index';
import { API_TIMEOUT_MS } from './post-head';

// HTMLRewriter is a Workers runtime global. This stand-in runs every handler against one recording element per
// selector and answers what was set, so a test reads exactly what the worker wrote into the head.
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

const SHELL = '<html><head><title>Community Document</title></head><body></body></html>';

function makeEnv(api?: (path: string, init?: RequestInit) => Promise<Response> | Response) {
  const assets: string[] = [];
  const env: Env = {
    ASSETS: {
      fetch: async (input) => {
        assets.push(new URL(typeof input === 'string' ? input : input.url).pathname);
        return new Response(SHELL, { headers: { 'content-type': 'text/html' } });
      },
    },
    ...(api
      ? {
          API: {
            fetch: async (input, init) =>
              api(new URL(typeof input === 'string' ? input : input.url).pathname, init),
          },
        }
      : {}),
  };
  return { env, assets };
}

const get = (path: string, env: Env, method = 'GET') =>
  worker.fetch(new Request(`https://livepages.app${path}`, { method }), env);

beforeEach(() => {
  vi.stubGlobal('HTMLRewriter', RecordingRewriter);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('community worker: a post page', () => {
  it("fills the shell's head with the post the id names", async () => {
    const seen: string[] = [];
    const { env } = makeEnv((path) => {
      seen.push(path);
      return Response.json({ post: communityPostFixture({ id: 'p1' }), related: [] });
    });
    const res = await get('/post/?id=p1', env);
    expect(seen).toEqual(['/api/community/posts/p1']);
    expect(res.status).toBe(200);
    const edits = (await res.json()) as Edits;
    expect(edits.title!.inner).toBe('Payments Platform | livepages Community');
    expect(edits['meta[name="description"]']!.attrs.content).toBe(
      'How our payment services talk to each other.',
    );
    expect(edits['meta[property="og:title"]']!.attrs.content).toBe(
      'Payments Platform | livepages Community',
    );
    expect(edits['meta[name="twitter:description"]']!.attrs.content).toBe(
      'How our payment services talk to each other.',
    );
    const head = edits.head!.appended.join('');
    expect(head).toContain(
      '<link rel="canonical" href="https://livepages.app/community/post/?id=p1"/>',
    );
    expect(head).toContain(
      '<meta property="og:url" content="https://livepages.app/community/post/?id=p1"/>',
    );
    expect(head).toContain('<script type="application/ld+json">');
  });

  it('answers 404 for a post that does not exist or is hidden, keeping the friendly page', async () => {
    const { env } = makeEnv(() => new Response('', { status: 404 }));
    const res = await get('/post/?id=gone', env);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(SHELL);
  });

  it('serves the shell unchanged when the api fails, is unreachable, or is not bound', async () => {
    for (const env of [
      makeEnv(() => new Response('', { status: 500 })).env,
      makeEnv(() => Promise.reject(new Error('down'))).env,
      makeEnv().env,
    ]) {
      const res = await get('/post/?id=p1', env);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SHELL);
    }
  });

  it('gives the api a bounded time before serving the shell', async () => {
    let signal: AbortSignal | undefined;
    const { env } = makeEnv((_path, init) => {
      signal = init?.signal ?? undefined;
      return Response.json({ post: communityPostFixture(), related: [] });
    });
    await get('/post/?id=p1', env);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(API_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it('leaves the shell alone with no id, and for a HEAD request', async () => {
    const api = vi.fn(() => Response.json({}));
    const { env } = makeEnv(api);
    expect(await (await get('/post/', env)).text()).toBe(SHELL);
    expect((await get('/post/?id=p1', env, 'HEAD')).status).toBe(200);
    expect(api).not.toHaveBeenCalled();
  });
});

describe('community worker: the sitemap', () => {
  it('lists every public post the api names', async () => {
    const { env } = makeEnv((path) => {
      expect(path).toBe('/api/community/sitemap');
      return Response.json({ posts: [{ id: 'p1', updatedAt: Date.UTC(2026, 9, 1) }] });
    });
    const res = await get('/sitemap.xml', env);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await res.text()).toContain(
      '<loc>https://livepages.app/community/post/?id=p1</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod>',
    );
  });

  it('is empty when the Community is switched off', async () => {
    const { env } = makeEnv(() => new Response('', { status: 404 }));
    const res = await get('/sitemap.xml', env);
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain('<url>');
  });

  it('asks crawlers to come back later when the api is unavailable', async () => {
    const res = await get('/sitemap.xml', makeEnv().env);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('3600');
  });
});

describe('community worker: the entry module', () => {
  it('exports only the handler, or the Workers runtime refuses to start it', async () => {
    expect(Object.keys(await import('./index'))).toEqual(['default']);
  });
});

describe('community worker: everything else', () => {
  it('is served straight from the assets', async () => {
    const { env, assets } = makeEnv();
    await get('/', env);
    await get('/_next/static/app.js', env);
    expect(assets).toEqual(['/', '/_next/static/app.js']);
  });
});
