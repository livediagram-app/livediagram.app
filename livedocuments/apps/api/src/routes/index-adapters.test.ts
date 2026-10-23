import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { handleFolders } from './folders';
import { handleDocumentIndexRoutes, handleDocumentList } from './document-index-routes';
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
  app: 'livedocuments',
  ownerId: 'user_a',
  teamId: null,
  folderId: null,
  title: `Document ${id}`,
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

describe('GET /api/documents', () => {
  it("lists the caller's own documents in one request a page, as document summaries", async () => {
    routes['GET /items'] = () => Response.json({ items: [item('A'), item('B')], nextCursor: null });
    const res = await handleDocumentList(ctx('GET', '/api/documents'));
    expect(res.status).toBe(200);
    const { documents } = (await res.json()) as {
      documents: { id: string; name: string; stats: unknown }[];
    };
    expect(documents.map((p) => [p.id, p.name])).toEqual([
      ['A', 'Document A'],
      ['B', 'Document B'],
    ]);
    expect(documents[0]!.stats).toMatchObject({ elements: 3, comments: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.search).toContain('app=livedocuments');
    expect(calls[0]!.search).toContain('team=personal');
  });

  it('reads at most five pages', async () => {
    routes['GET /items'] = () => Response.json({ items: [item('A')], nextCursor: 'more' });
    await handleDocumentList(ctx('GET', '/api/documents'));
    expect(calls).toHaveLength(5);
  });

  it("answers the index's refusal as its own, and 503 when the index cannot be reached", async () => {
    routes['GET /items'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    expect((await handleDocumentList(ctx('GET', '/api/documents'))).status).toBe(403);
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handleDocumentList(ctx('GET', '/api/documents'))).status).toBe(503);
  });
});

describe('the index doors on one document', () => {
  it('trashes, and deletes for good on ?permanent=1', async () => {
    routes['DELETE /items/P'] = () => new Response(null, { status: 204 });
    expect((await handleDocumentIndexRoutes(ctx('DELETE', '/api/documents/P')))!.status).toBe(204);
    expect(
      (await handleDocumentIndexRoutes(ctx('DELETE', '/api/documents/P?permanent=1')))!.status,
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
    const res = await handleDocumentIndexRoutes(
      ctx('POST', '/api/documents/P/share', { body: { role: 'view', expiry: '7d', tabId: 't1' } }),
    );
    expect(res!.status).toBe(201);
    expect(await res!.json()).toEqual({
      link: {
        code: 'CODE2345',
        documentId: 'P',
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
    const res = await handleDocumentIndexRoutes(
      ctx('POST', '/api/documents/P/copy', { body: { name: 'Copy' } }),
    );
    expect(res!.status).toBe(201);
    expect((await res!.json<{ document: { id: string } }>()).document.id).toBe('C');
  });

  it('leaves every other document route to the document', async () => {
    expect(await handleDocumentIndexRoutes(ctx('GET', '/api/documents/P'))).toBeNull();
    expect(await handleDocumentIndexRoutes(ctx('PUT', '/api/documents/P/tabs/t1'))).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('the Trash, folders, teams and links', () => {
  it('lists the Trash with each document purge date and its team name', async () => {
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
    const teams = await handleTeams(ctx('GET', '/api/teams'));
    expect((await teams.json<{ teams: unknown[] }>()).teams).toMatchObject([
      { id: 'team1', name: 'Design', myRole: 'member' },
    ]);
    expect((await handleTeams(ctx('GET', '/api/teams/other/library'))).status).toBe(404);
  });

  it('answers index_unavailable for a share code on a deployment without an index', async () => {
    const c = ctx('GET', '/api/share/CODE2345');
    const res = await handleShare({
      ...c,
      env: { ...c.env, INDEX_ORIGIN: undefined },
    } as RouteContext);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'index_unavailable' });
  });

  it('resolves a share code to what it opens', async () => {
    routes['GET /share/CODE2345'] = () =>
      Response.json({ item: item('P'), level: 'view', tabId: null });
    const res = await handleShare(ctx('GET', '/api/share/CODE2345'));
    expect(await res.json()).toEqual({
      document: { id: 'P', name: 'Document P' },
      role: 'view',
      tabId: null,
    });
  });
});
