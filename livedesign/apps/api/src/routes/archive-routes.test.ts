import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDesignIndexRoutes, handleDesignList } from './design-index-routes';

// Archived for API clients (the MCP's archive_design and unarchive_design, the CLI's design archive and unarchive;
// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived"): POST /api/designs/:id/archive and
// /unarchive pass to the index as the caller, its refusals answered as its own, and `archived=1` lists the Archived.

const ENV = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'k' } as unknown as Env;
const ITEM = {
  id: 'd1',
  app: 'livedesign',
  ownerId: 'user_a',
  teamId: null,
  folderId: null,
  title: 'Old plan',
  createdAt: 1,
  updatedAt: 2,
  archivedAt: 3,
};

let calls: { method: string; path: string; body: unknown }[] = [];
let answer: (path: string) => Response = () => Response.json({ item: ITEM });

beforeEach(() => {
  calls = [];
  answer = () => Response.json({ item: ITEM });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const text = await req.text();
    calls.push({
      method: req.method,
      // The index as its client reaches it, under /api/index or at its root.
      path: `${url.pathname.replace(/^\/api\/index/, '')}${url.search}`,
      body: text ? JSON.parse(text) : null,
    });
    return answer(url.pathname);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const post = (path: string, body?: unknown) =>
  handleDesignIndexRoutes(
    makeTestRouteContext('POST', path, {
      accountUserId: 'user_a',
      owner: 'user_a',
      token: { id: 'tok1' },
      env: ENV,
      grant: null,
      ...(body !== undefined ? { body } : {}),
    }),
  );

describe('POST /api/designs/:id/archive', () => {
  it('archives at the index and answers the design', async () => {
    const res = (await post('/api/designs/d1/archive'))!;
    expect(res.status).toBe(200);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /items/d1/archive']);
    const body = (await res.json()) as { design: { id: string; name: string } };
    expect(body.design).toMatchObject({ id: 'd1', name: 'Old plan' });
  });

  it('answers the index’s refusal as its own: not the owner, or in the Trash', async () => {
    answer = () => Response.json({ error: 'not_owner' }, { status: 403 });
    const notOwner = (await post('/api/designs/d1/archive'))!;
    expect(notOwner.status).toBe(403);
    expect(await notOwner.json()).toEqual({ error: 'not_owner' });
    answer = () => Response.json({ error: 'trashed' }, { status: 409 });
    expect((await post('/api/designs/d1/archive'))!.status).toBe(409);
  });
});

describe('POST /api/designs/:id/unarchive', () => {
  it('moves it out to the top of My Work unless told where', async () => {
    expect((await post('/api/designs/d1/unarchive'))!.status).toBe(200);
    expect(
      (await post('/api/designs/d1/unarchive', { folderId: 'f1', teamId: 't1' }))!.status,
    ).toBe(200);
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['PATCH', '/items/d1', { folderId: null, teamId: null }],
      ['PATCH', '/items/d1', { folderId: 'f1', teamId: 't1' }],
    ]);
  });

  it('refuses a body that names no place, without asking the index', async () => {
    const res = (await post('/api/designs/d1/unarchive', { folderId: 7 }))!;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(calls).toEqual([]);
  });

  it('leaves another door to the rest of the routes', async () => {
    expect(
      await handleDesignIndexRoutes(
        makeTestRouteContext('GET', '/api/designs/d1/archive', { env: ENV }),
      ),
    ).toBeNull();
  });
});

describe('GET /api/designs?archived=1', () => {
  it('lists the Archived view at the index', async () => {
    answer = () => Response.json({ items: [ITEM], nextCursor: null });
    const res = await handleDesignList(
      makeTestRouteContext('GET', '/api/designs?team=all&archived=1&limit=5', {
        accountUserId: 'user_a',
        owner: 'user_a',
        env: ENV,
        grant: null,
      }),
    );
    expect(res.status).toBe(200);
    expect(calls[0]!.path).toContain('view=archived');
    const body = (await res.json()) as { designs: { id: string }[] };
    expect(body.designs.map((d) => d.id)).toEqual(['d1']);
  });
});
