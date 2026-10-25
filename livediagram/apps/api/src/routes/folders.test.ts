import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { handleFolders } from './folders';
import { makeTestRouteContext } from './test-route-context';

// GET /api/folders for API clients (docs/specs/013-workspace/folders.md; index-adapters.ts): the caller's own
// folders as the index files them, in the shape the MCP server and the CLI have always read, and POST for the CLI's
// `folder create`. Renaming, moving and deleting a folder are the index's (the editor calls it through /api/index/*).

const INDEX_ORIGIN = 'https://index.test';

let index: Record<string, () => Response>;
let calls: { method: string; path: string; search: URLSearchParams }[];

beforeEach(() => {
  index = {};
  calls = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname.replace('/api/index', '');
    calls.push({ method: req.method, path, search: url.searchParams });
    const answer = index[`${req.method} ${path}`];
    return answer ? answer() : Response.json({ error: 'not_found' }, { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const folder = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  ownerId: 'owner-1',
  parentId: null,
  teamId: null,
  name: `Folder ${id}`,
  createdAt: 1,
  updatedAt: 2,
  ...over,
});

const call = (
  method: string,
  path: string,
  opts: { owner?: string | null; env?: Env; body?: unknown } = {},
) => {
  const owner = opts.owner === undefined ? 'user_owner' : opts.owner;
  return handleFolders(
    makeTestRouteContext(method, path, {
      env: opts.env ?? ({ INDEX_ORIGIN, INDEX_KEY: 'k' } as Env),
      ...(opts.body === undefined ? {} : { body: opts.body }),
      owner,
      verifiedUserId: owner,
      token: { id: 'tok_1' },
    }),
  );
};

describe('GET /api/folders', () => {
  it("lists the caller's personal folders, every page, as the clients read them", async () => {
    let page = 0;
    index['GET /folders'] = () =>
      Response.json({
        folders: [folder(`f${page}`, page === 1 ? { parentId: 'f0' } : {})],
        nextCursor: ++page < 2 ? 'next' : null,
      });
    const res = await call('GET', '/api/folders');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      folders: [
        {
          id: 'f0',
          ownerId: 'owner-1',
          parentId: null,
          teamId: null,
          name: 'Folder f0',
          createdAt: 1,
          updatedAt: 2,
        },
        {
          id: 'f1',
          ownerId: 'owner-1',
          parentId: 'f0',
          teamId: null,
          name: 'Folder f1',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });
    expect(
      calls.map((c) => [c.method, c.path, c.search.get('team'), c.search.get('cursor')]),
    ).toEqual([
      ['GET', '/folders', 'personal', null],
      ['GET', '/folders', 'personal', 'next'],
    ]);
  });

  it("passes the index's refusal on", async () => {
    index['GET /folders'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    const res = await call('GET', '/api/folders');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('needs a caller, and an index', async () => {
    expect((await call('GET', '/api/folders', { owner: null })).status).toBe(400);
    const res = await call('GET', '/api/folders', { env: {} as Env });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'index_unavailable' });
    expect(calls).toEqual([]);
  });

  it('answers every other folder route 404 without asking the index', async () => {
    expect((await call('PATCH', '/api/folders')).status).toBe(404);
    expect((await call('PUT', '/api/folders/f1')).status).toBe(404);
    expect((await call('DELETE', '/api/folders/f1')).status).toBe(404);
    expect((await call('GET', '/api/folders/f1')).status).toBe(404);
    expect(calls).toEqual([]);
  });
});

describe('POST /api/folders', () => {
  it('makes the folder at the index as the caller, and answers it as the clients read it', async () => {
    let sent: unknown;
    index['POST /folders'] = () =>
      Response.json({ folder: folder('f9', { parentId: 'f0' }) }, { status: 201 });
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') sent = JSON.parse(init.body as string);
      return original(input, init);
    });
    const res = await call('POST', '/api/folders', {
      body: { id: 'f9', name: 'Folder f9', parentId: 'f0' },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      folder: {
        id: 'f9',
        ownerId: 'owner-1',
        parentId: 'f0',
        teamId: null,
        name: 'Folder f9',
        createdAt: 1,
        updatedAt: 2,
      },
    });
    expect(sent).toEqual({ id: 'f9', name: 'Folder f9', parentId: 'f0' });
  });

  it("refuses a malformed body, and passes the index's refusal on", async () => {
    expect((await call('POST', '/api/folders', { body: { name: 7 } })).status).toBe(400);
    expect(calls).toEqual([]);
    index['POST /folders'] = () => Response.json({ error: 'folder_not_found' }, { status: 404 });
    const res = await call('POST', '/api/folders', { body: { name: 'A', parentId: 'gone' } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'folder_not_found' });
  });
});
