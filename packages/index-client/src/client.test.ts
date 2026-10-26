import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient, IndexError, queryString } from './client';
import { APP_KINDS, APPS, levelAtLeast } from './constants';

type Seen = { url: string; method: string; headers: Headers; body: unknown };

function fakeFetch(respond: (seen: Seen) => Response = () => Response.json({})) {
  const seen: Seen[] = [];
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const entry: Seen = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    seen.push(entry);
    return respond(entry);
  }) as typeof fetch;
  return { seen, doFetch };
}

describe('constants', () => {
  it('give every app one kind', () => {
    expect(APPS.map((app) => APP_KINDS[app])).toEqual(['canvas', 'plan', 'document', 'design']);
  });

  it('order the levels', () => {
    expect(levelAtLeast('edit', 'participate')).toBe(true);
    expect(levelAtLeast('participate', 'participate')).toBe(true);
    expect(levelAtLeast('view', 'participate')).toBe(false);
  });
});

describe('queryString', () => {
  it('drops unset values and encodes the rest', () => {
    expect(queryString({ app: 'liveplanner', q: 'a&b %', folder: undefined, team: null })).toBe(
      '?app=liveplanner&q=a%26b+%25',
    );
    expect(queryString({})).toBe('');
    expect(queryString({ q: '' })).toBe('');
  });
});

describe('createIndexClient', () => {
  it("calls its own origin's /api/index by default, with the bearer token", async () => {
    const { seen, doFetch } = fakeFetch(() => Response.json({ items: [], nextCursor: null }));
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.listItems({ app: 'liveplanner', view: 'recent', limit: 20 });
    expect(seen[0]).toMatchObject({
      url: '/api/index/items?app=liveplanner&view=recent&limit=20',
      method: 'GET',
    });
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer tok');
  });

  it("asks Home's folded reads beside Recent's page: `mine` as a cap, `any` as 1", async () => {
    const { seen, doFetch } = fakeFetch(() => Response.json({ items: [], nextCursor: null }));
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.listItems({ view: 'recent', limit: 8, used: 4, mine: 200, any: true });
    await client.listItems({ view: 'recent', any: false });
    expect(seen.map((s) => s.url)).toEqual([
      '/api/index/items?view=recent&limit=8&used=4&mine=200&any=1',
      '/api/index/items?view=recent',
    ]);
  });

  it('builds each path, method and body', async () => {
    const { seen, doFetch } = fakeFetch((s) =>
      s.method === 'DELETE' || s.url.includes('/open')
        ? new Response(null, { status: 204 })
        : Response.json({}),
    );
    const client = createIndexClient({
      baseUrl: 'http://localhost:8793/api/index/',
      getToken: async () => 'tok',
      fetch: doFetch,
    });
    await client.createItem({ app: 'livedesign', title: 'Logo' });
    await client.updateItem('i/1', { title: 'New' });
    await client.deleteItem('i1', { permanent: true });
    await client.deleteItem('i1');
    await client.setPlacementDefault('mode:plan', 'f1');
    await client.setSharePassword('i1', null);
    await client.extendShareLink('CODE');
    await client.emptyTrash({ team: 'team-1' });
    await client.recordOpen('i1');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST http://localhost:8793/api/index/items',
      'PATCH http://localhost:8793/api/index/items/i%2F1',
      'DELETE http://localhost:8793/api/index/items/i1?permanent=true',
      'DELETE http://localhost:8793/api/index/items/i1',
      'PUT http://localhost:8793/api/index/placement-defaults/mode%3Aplan',
      'PUT http://localhost:8793/api/index/items/i1/share-password',
      'POST http://localhost:8793/api/index/share/CODE/extend',
      'DELETE http://localhost:8793/api/index/trash?team=team-1',
      'POST http://localhost:8793/api/index/items/i1/open',
    ]);
    expect(seen[0]!.body).toEqual({ app: 'livedesign', title: 'Logo' });
    expect(seen[0]!.headers.get('Content-Type')).toBe('application/json');
    expect(seen[4]!.body).toEqual({ folderId: 'f1' });
    expect(seen[5]!.body).toEqual({ password: null });
    expect(seen[2]!.headers.get('Content-Type')).toBeNull();
  });

  it('sends a link visitor’s code and password, and no token when there is none', async () => {
    const { seen, doFetch } = fakeFetch(() =>
      Response.json({ grant: 'g', level: 'view', tabId: null, expiresAt: 1 }),
    );
    const client = createIndexClient({ getToken: () => null, fetch: doFetch });
    const out = await client.grant('i1', { code: 'ABC', password: 'pw' });
    expect(out.grant).toBe('g');
    expect(seen[0]!.headers.get('Authorization')).toBeNull();
    expect(seen[0]!.headers.get('X-Share-Code')).toBe('ABC');
    expect(seen[0]!.headers.get('X-Share-Password')).toBe('pw');
    await client.resolveShare('XYZ');
    expect(seen[1]!.url).toBe('/api/index/share/XYZ');
    expect(seen[1]!.headers.get('X-Share-Code')).toBe('XYZ');
    expect(seen[1]!.headers.get('X-Share-Password')).toBeNull();
  });

  it('throws the error code with its status', async () => {
    const { doFetch } = fakeFetch(() =>
      Response.json({ error: 'password_required' }, { status: 401 }),
    );
    const client = createIndexClient({ getToken: () => null, fetch: doFetch });
    const err = await client.getItem('i1', { code: 'C' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IndexError);
    expect(err).toMatchObject({ status: 401, code: 'password_required' });
  });

  it('answers a non-JSON failure as unknown', async () => {
    const { doFetch } = fakeFetch(() => new Response('bad gateway', { status: 502 }));
    const client = createIndexClient({ getToken: () => 't', fetch: doFetch });
    await expect(client.listFolders()).rejects.toMatchObject({ status: 502, code: 'unknown' });
  });
});

describe('createIndexClient reads', () => {
  it('pages folders and passes a signal through, so a superseded read is cancelled', async () => {
    const signals: (AbortSignal | null | undefined)[] = [];
    const urls: string[] = [];
    const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      urls.push(String(input));
      signals.push(init.signal);
      init.signal?.throwIfAborted();
      return Response.json({ folders: [], items: [], nextCursor: null });
    }) as typeof fetch;
    const client = createIndexClient({ getToken: () => null, fetch: doFetch });
    const page = await client.listFolders({ limit: 200, cursor: 'c1' });
    expect(page.nextCursor).toBeNull();
    expect(urls[0]).toBe('/api/index/folders?limit=200&cursor=c1');

    const controller = new AbortController();
    controller.abort();
    await expect(
      client.listItems({ q: 'road' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals[1]).toBe(controller.signal);
  });
});

describe('createIndexAppClient', () => {
  it("pushes with the app's key and name", async () => {
    const { seen, doFetch } = fakeFetch(() => new Response(null, { status: 204 }));
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: 'http://localhost:8793/api/index',
      fetch: doFetch,
    });
    await app.pushSummary('i1', { elements: 3 }, 1000);
    await app.pushCollab('i1', 'tab 1', { threads: [], actions: [] });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'PUT http://localhost:8793/api/index/app/items/i1/summary',
      'PUT http://localhost:8793/api/index/app/items/i1/collab/tab%201',
    ]);
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer k');
    expect(seen[0]!.headers.get('X-Index-App')).toBe('liveplanner');
    expect(seen[0]!.body).toEqual({ summary: { elements: 3 }, updatedAt: 1000 });
  });

  it('defaults to production and throws a refusal', async () => {
    const { seen, doFetch } = fakeFetch(() =>
      Response.json({ error: 'wrong_app' }, { status: 403 }),
    );
    const app = createIndexAppClient({ app: 'livediagram', key: 'k', fetch: doFetch });
    await expect(app.pushSummary('i1', {}, 1)).rejects.toMatchObject({ code: 'wrong_app' });
    expect(seen[0]!.url).toBe('https://www.liveworkspace.app/api/index/app/items/i1/summary');
  });
});
