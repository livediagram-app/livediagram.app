import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { handleFolders } from './folders';
import { handleProjectIndexRoutes, handleProjectList } from './project-index-routes';
import { handleShare } from './share';
import { handleTeams } from './teams';
import { handleTrash } from './trash';
import type { RouteContext } from './context';

// The doors API clients (the MCP server, the CLI) still call, answered from the index in the shapes they have
// always read (index-adapters.ts): each is one index request per page, as the caller (an API token's account,
// with this app's key).

const ENV = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'k' } as unknown as Env;

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  app: 'liveplanner',
  ownerId: 'user_a',
  teamId: null,
  folderId: null,
  title: `Plan ${id}`,
  source: null,
  summary: { elements: 3, comments: 1, bytes: 10, empty: false },
  sharedVia: null,
  createdAt: 1,
  updatedAt: 2,
  trashedAt: null,
  ...over,
});

let calls: { method: string; path: string; search: string; body: string }[] = [];
let routes: Record<string, () => Response> = {};

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname.replace('/api/index', '');
    calls.push({ method: req.method, path, search: url.search, body: await req.text() });
    const answer = routes[`${req.method} ${path}`];
    return answer ? answer() : Response.json({ error: 'not_found' }, { status: 404 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ctx(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const url = new URL(`https://api.test${path}`);
  return {
    request: new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    }),
    env: ENV,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    accountUserId: null,
    verifiedUserId: 'user_a',
    accountEmail: null,
    resolveOwner: () => 'user_a',
    token: { id: 'tok1' },
    workbench: null,
    teams: [{ id: 'team1', name: 'Design', role: 'member' }],
    bearer: null,
  } as unknown as RouteContext;
}

describe('GET /api/projects', () => {
  it("lists the caller's own plans in one request a page, as plan summaries", async () => {
    routes['GET /items'] = () => Response.json({ items: [item('A'), item('B')], nextCursor: null });
    const res = await handleProjectList(ctx('GET', '/api/projects'));
    expect(res.status).toBe(200);
    const { projects } = (await res.json()) as {
      projects: { id: string; name: string; stats: unknown }[];
    };
    expect(projects.map((p) => [p.id, p.name])).toEqual([
      ['A', 'Plan A'],
      ['B', 'Plan B'],
    ]);
    expect(projects[0]!.stats).toMatchObject({ elements: 3, comments: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.search).toContain('app=liveplanner');
    expect(calls[0]!.search).toContain('team=personal');
  });

  it('reads at most five pages', async () => {
    routes['GET /items'] = () => Response.json({ items: [item('A')], nextCursor: 'more' });
    await handleProjectList(ctx('GET', '/api/projects'));
    expect(calls).toHaveLength(5);
  });

  it("answers the index's refusal as its own, and 503 when the index cannot be reached", async () => {
    routes['GET /items'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    expect((await handleProjectList(ctx('GET', '/api/projects'))).status).toBe(403);
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handleProjectList(ctx('GET', '/api/projects'))).status).toBe(503);
  });
});

describe('the index doors on one plan', () => {
  it('takes an item offline for good, not to the Trash', async () => {
    routes['DELETE /items/P'] = () => new Response(null, { status: 204 });
    const res = await handleProjectIndexRoutes(
      ctx('DELETE', '/api/projects/P', { headers: { 'X-Project-Conversion': 'offline' } }),
    );
    expect(res!.status).toBe(204);
    expect(calls.map((c) => c.search)).toEqual(['?permanent=true&reason=offline']);
  });

  it('trashes, and deletes for good on ?permanent=1', async () => {
    routes['DELETE /items/P'] = () => new Response(null, { status: 204 });
    expect((await handleProjectIndexRoutes(ctx('DELETE', '/api/projects/P')))!.status).toBe(204);
    expect(
      (await handleProjectIndexRoutes(ctx('DELETE', '/api/projects/P?permanent=1')))!.status,
    ).toBe(204);
    expect(calls.map((c) => c.search)).toEqual(['', '?permanent=true']);
  });

  it('mints a share link with its level, expiry and tab', async () => {
    routes['POST /items/P/share'] = () =>
      Response.json(
        {
          link: {
            code: 'CODE2345',
            itemId: 'P',
            level: 'view',
            tabId: 't1',
            expiry: '7d',
            expiresAt: 9,
            createdAt: 1,
          },
        },
        { status: 201 },
      );
    const res = await handleProjectIndexRoutes(
      ctx('POST', '/api/projects/P/share', { body: { role: 'view', expiry: '7d', tabId: 't1' } }),
    );
    expect(res!.status).toBe(201);
    expect(await res!.json()).toEqual({
      link: {
        code: 'CODE2345',
        projectId: 'P',
        role: 'view',
        createdAt: 1,
        expiry: '7d',
        expiresAt: 9,
        tabId: 't1',
      },
    });
    expect(JSON.parse(calls[0]!.body)).toEqual({ level: 'view', expiry: '7d', tabId: 't1' });
  });

  it('copies, the copy being the caller own', async () => {
    routes['POST /items/P/copy'] = () =>
      Response.json({ item: item('C', { title: 'Copy' }) }, { status: 201 });
    const res = await handleProjectIndexRoutes(
      ctx('POST', '/api/projects/P/copy', { body: { name: 'Copy' } }),
    );
    expect(res!.status).toBe(201);
    expect((await res!.json<{ project: { id: string } }>()).project.id).toBe('C');
  });

  it('leaves every other plan route to the plan', async () => {
    expect(await handleProjectIndexRoutes(ctx('GET', '/api/projects/P'))).toBeNull();
    expect(await handleProjectIndexRoutes(ctx('PUT', '/api/projects/P/tabs/t1'))).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('the Trash, folders, teams and links', () => {
  it('lists the Trash with each plan purge date and its team name', async () => {
    routes['GET /trash'] = () =>
      Response.json({
        items: [item('T', { teamId: 'team1', trashedAt: 1000, trashReason: 'deleted' })],
        nextCursor: null,
      });
    const res = await handleTrash(ctx('GET', '/api/trash'));
    const { trash } = (await res.json()) as {
      trash: { id: string; teamName: string; purgeAt: number }[];
    };
    expect(trash[0]).toMatchObject({ id: 'T', teamName: 'Design', trashedAt: 1000 });
    expect(trash[0]!.purgeAt).toBeGreaterThan(1000);
  });

  it('restores, and refuses what it does not route without asking the index', async () => {
    routes['POST /items/T/restore'] = () => Response.json({ item: item('T') });
    expect((await handleTrash(ctx('POST', '/api/trash/T/restore'))).status).toBe(200);
    calls = [];
    expect((await handleTrash(ctx('PUT', '/api/trash/T'))).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("lists the caller's folders, and its teams from its token", async () => {
    routes['GET /folders'] = () =>
      Response.json({
        folders: [
          {
            id: 'f1',
            ownerId: 'user_a',
            parentId: null,
            teamId: null,
            name: 'Q3',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        nextCursor: null,
      });
    const folders = await handleFolders(ctx('GET', '/api/folders'));
    expect((await folders.json<{ folders: { name: string }[] }>()).folders[0]!.name).toBe('Q3');
    // The CLI's `folder create`: made at the index as the caller.
    routes['POST /folders'] = () =>
      Response.json(
        {
          folder: {
            id: 'f2',
            ownerId: 'user_a',
            parentId: 'f1',
            teamId: null,
            name: 'Q4',
            createdAt: 3,
            updatedAt: 3,
          },
        },
        { status: 201 },
      );
    const made = await handleFolders(
      ctx('POST', '/api/folders', { body: { id: 'f2', name: 'Q4', parentId: 'f1' } }),
    );
    expect(made.status).toBe(201);
    expect((await made.json<{ folder: { id: string; parentId: string } }>()).folder).toMatchObject({
      id: 'f2',
      parentId: 'f1',
    });
    expect(JSON.parse(calls.find((c) => c.method === 'POST')!.body)).toEqual({
      id: 'f2',
      name: 'Q4',
      parentId: 'f1',
    });
    const teams = await handleTeams(ctx('GET', '/api/teams'));
    expect((await teams.json<{ teams: unknown[] }>()).teams).toMatchObject([
      { id: 'team1', name: 'Design', myRole: 'member' },
    ]);
    expect((await handleTeams(ctx('GET', '/api/teams/other/library'))).status).toBe(404);
  });

  it('answers index_unavailable for a share code on a deployment without an index', async () => {
    const c = ctx('GET', '/api/share/CODE2345');
    const res = await handleShare({ ...c, env: { ...c.env, INDEX_ORIGIN: undefined } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'index_unavailable' });
  });

  it('resolves a share code to what it opens', async () => {
    routes['GET /share/CODE2345'] = () =>
      Response.json({ item: item('P'), level: 'view', tabId: null });
    const res = await handleShare(ctx('GET', '/api/share/CODE2345'));
    expect(await res.json()).toEqual({
      project: { id: 'P', name: 'Plan P' },
      role: 'view',
      tabId: null,
    });
  });
});
