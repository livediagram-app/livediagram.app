import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgeCached } from './edge-cache';

// A Cache API stand-in: what was put, answered by URL.
function stubCaches() {
  const store = new Map<string, Response>();
  vi.stubGlobal('caches', {
    default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => void store.set(req.url, res),
    },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('edgeCached', () => {
  const url = new URL('https://livediagram.app/api/community/featured');

  it('runs the query once, then answers from the edge', async () => {
    stubCaches();
    const produce = vi.fn(async () => Response.json({ posts: [] }));
    const first = await edgeCached(url, 60, produce);
    const second = await edgeCached(url, 60, produce);
    expect(produce).toHaveBeenCalledOnce();
    expect(first.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(await second.json()).toEqual({ posts: [] });
  });

  it('never keeps a failure', async () => {
    const store = stubCaches();
    const res = await edgeCached(url, 60, async () => new Response('no', { status: 500 }));
    expect(res.status).toBe(500);
    expect(store.size).toBe(0);
  });

  it('skips the cache on localhost and where there is no Cache API', async () => {
    const store = stubCaches();
    const produce = vi.fn(async () => Response.json({}));
    await edgeCached(new URL('http://localhost:8787/api/community/featured'), 60, produce);
    await edgeCached(new URL('http://localhost:8787/api/community/featured'), 60, produce);
    expect(produce).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(0);
    vi.unstubAllGlobals();
    expect((await edgeCached(url, 60, async () => Response.json({}))).status).toBe(200);
  });
});
