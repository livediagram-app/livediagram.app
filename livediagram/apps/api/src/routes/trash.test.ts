import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trashPurgeDueAt } from '@livediagram/api-schema';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleTrash } from './trash';

// /api/trash for API clients (docs/specs/013-workspace/trash.md "The API"; index-adapters.ts): the Trash is the
// index's, so each door is the index's answer in the shape the MCP server and the CLI have always read. Who may list,
// restore or purge what is the index's rule; its refusal passes through.

const INDEX_ORIGIN = 'https://index.test';
const T0 = 1_700_000_000_000;

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

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  app: 'livediagram',
  ownerId: 'user_me',
  teamId: null,
  folderId: null,
  title: `Diagram ${id}`,
  createdAt: T0,
  updatedAt: T0,
  trashedAt: T0,
  ...over,
});

function call(method: string, path: string, opts: { owner?: string | null; env?: Env } = {}) {
  const owner = opts.owner === undefined ? 'user_me' : opts.owner;
  return handleTrash(
    makeTestRouteContext(method, path, {
      env: opts.env ?? ({ INDEX_ORIGIN, INDEX_KEY: 'k' } as Env),
      owner,
      verifiedUserId: owner,
      token: { id: 'tok_1' },
      teams: [{ id: 'crew', name: 'Crew', role: 'member' }],
    }),
  );
}

describe('GET /api/trash', () => {
  it('lists the personal and joined team Trash, with each purge date and team name', async () => {
    index['GET /trash'] = () =>
      Response.json({
        items: [
          item('mine'),
          item('ours', { ownerId: 'user_bob', teamId: 'crew', trashedAt: T0 + 5 }),
          item('gone', { teamId: 'left', trashReason: 'offline' }),
        ],
        nextCursor: null,
      });
    const res = await call('GET', '/api/trash');
    expect(res.status).toBe(200);
    expect((await res.json<{ trash: unknown[] }>()).trash).toEqual([
      {
        id: 'mine',
        name: 'Diagram mine',
        teamId: null,
        teamName: null,
        trashedAt: T0,
        purgeAt: trashPurgeDueAt(T0),
        reason: 'deleted',
      },
      {
        id: 'ours',
        name: 'Diagram ours',
        teamId: 'crew',
        teamName: 'Crew',
        trashedAt: T0 + 5,
        purgeAt: trashPurgeDueAt(T0 + 5),
        reason: 'deleted',
      },
      {
        id: 'gone',
        name: 'Diagram gone',
        teamId: 'left',
        teamName: null,
        trashedAt: T0,
        purgeAt: trashPurgeDueAt(T0),
        reason: 'offline',
      },
    ]);
    expect(calls.map((c) => [c.method, c.path, c.search.get('app')])).toEqual([
      ['GET', '/trash', 'livediagram'],
    ]);
  });

  it('reads every page', async () => {
    let page = 0;
    index['GET /trash'] = () =>
      Response.json({ items: [item(`p${page}`)], nextCursor: ++page < 3 ? `c${page}` : null });
    const res = await call('GET', '/api/trash');
    expect((await res.json<{ trash: { id: string }[] }>()).trash.map((t) => t.id)).toEqual([
      'p0',
      'p1',
      'p2',
    ]);
    expect(calls.map((c) => c.search.get('cursor'))).toEqual([null, 'c1', 'c2']);
  });

  it('needs a caller, and an index', async () => {
    expect((await call('GET', '/api/trash', { owner: null })).status).toBe(400);
    const res = await call('GET', '/api/trash', { env: {} as Env });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'index_unavailable' });
    expect(calls).toEqual([]);
  });
});

describe('POST /api/trash/:id/restore', () => {
  it('restores the document and answers it', async () => {
    index['POST /items/mine/restore'] = () =>
      Response.json({ item: item('mine', { trashedAt: null }) });
    const res = await call('POST', '/api/trash/mine/restore');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ document: { id: 'mine', name: 'Diagram mine' } });
  });

  it("passes the index's refusal on: a document the caller may not restore reads as missing", async () => {
    const res = await call('POST', '/api/trash/bobs/restore');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('DELETE /api/trash/:id', () => {
  it('purges one document for good', async () => {
    index['DELETE /items/mine'] = () => new Response(null, { status: 204 });
    const res = await call('DELETE', '/api/trash/mine');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.search.get('permanent')).toBeTruthy();
  });

  it("passes the index's refusal on", async () => {
    index['DELETE /items/ours'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    const res = await call('DELETE', '/api/trash/ours');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });
});

describe('DELETE /api/trash', () => {
  it('empties the personal Trash of canvases and answers how many went', async () => {
    index['DELETE /trash'] = () => Response.json({ purged: 3 });
    const res = await call('DELETE', '/api/trash');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purged: 3 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.search.get('app')).toBe('livediagram');
    expect(calls[0]!.search.get('team')).toBeNull();
  });

  it("empties a joined team's Trash", async () => {
    index['DELETE /trash'] = () => Response.json({ purged: 1 });
    const res = await call('DELETE', '/api/trash?team=crew');
    expect(await res.json()).toEqual({ purged: 1 });
    expect(calls[0]!.search.get('team')).toBe('crew');
    expect(calls[0]!.search.get('app')).toBe('livediagram');
  });

  it('a team the caller has not joined reads as missing, without asking the index', async () => {
    const res = await call('DELETE', '/api/trash?team=strangers');
    expect(res.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("passes the index's refusal on", async () => {
    index['DELETE /trash'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    expect((await call('DELETE', '/api/trash')).status).toBe(403);
  });
});

describe('unknown /api/trash routes', () => {
  it('answer 404 without asking the index', async () => {
    expect((await call('PUT', '/api/trash')).status).toBe(404);
    expect((await call('PUT', '/api/trash/mine')).status).toBe(404);
    expect((await call('GET', '/api/trash/mine')).status).toBe(404);
    expect((await call('POST', '/api/trash/mine/other')).status).toBe(404);
    expect(calls).toEqual([]);
  });
});
