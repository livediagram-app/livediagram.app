import { describe, expect, it } from 'vitest';
import {
  createIndexAppClient,
  createIndexClient,
  IndexError,
  queryString,
  retryAfterMsOf,
} from './client';
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
    expect(APPS.map((app) => APP_KINDS[app])).toEqual([
      'canvas',
      'plan',
      'document',
      'design',
      'space',
    ]);
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

describe('createIndexClient connected tabs', () => {
  it("sends the host's grant to each door, never a token in its place", async () => {
    const { seen, doFetch } = fakeFetch((s) =>
      s.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ ok: true }),
    );
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.makeConnection('h/1', { targetId: 't1', tabId: 'tab1', both: true }, 'g1');
    await client.openConnection('cn_abc', 'g2');
    await client.takeBackConnection('cn_abc', 'g3');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST /api/index/items/h%2F1/connections',
      'GET /api/index/connections/cn_abc',
      'DELETE /api/index/connections/cn_abc',
    ]);
    expect(seen.map((s) => s.headers.get('X-Index-Grant'))).toEqual(['g1', 'g2', 'g3']);
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer tok');
    expect(seen[0]!.body).toEqual({ targetId: 't1', tabId: 'tab1', both: true });
  });

  it('throws why a connection opens nothing', async () => {
    const { doFetch } = fakeFetch(() =>
      Response.json({ error: 'connection_link_removed' }, { status: 410 }),
    );
    const client = createIndexClient({ getToken: () => null, fetch: doFetch });
    await expect(client.openConnection('cn_x', 'g')).rejects.toMatchObject({
      status: 410,
      code: 'connection_link_removed',
    });
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

  it("reads a team's audit log as pages and as CSV, with where the next file starts", async () => {
    const { seen, doFetch } = fakeFetch((s) =>
      s.url.includes('format=csv')
        ? new Response('Time,Kind\r\n', { headers: { 'X-Next-Cursor': 'c2' } })
        : Response.json({ events: [], nextCursor: null }),
    );
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    expect(await client.teamAudit({ team: 't1', kind: 'shared', limit: 20 })).toEqual({
      events: [],
      nextCursor: null,
    });
    expect(seen[0]!.url).toBe('/api/index/team-audit?team=t1&kind=shared&limit=20');
    expect(await client.teamAuditCsv({ team: 't1', from: 5 })).toEqual({
      csv: 'Time,Kind\r\n',
      nextCursor: 'c2',
    });
    expect(seen[1]!.url).toBe('/api/index/team-audit?team=t1&from=5&format=csv');
  });

  it("refuses a CSV read as any other, with the index's code or `unknown`", async () => {
    let answer = Response.json({ error: 'not_team_admin' }, { status: 403 });
    const doFetch = (async () => answer) as typeof fetch;
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await expect(client.teamAuditCsv({ team: 't1' })).rejects.toMatchObject({
      status: 403,
      code: 'not_team_admin',
    });
    answer = new Response('down', { status: 502 });
    await expect(client.teamAuditCsv({ team: 't1' })).rejects.toMatchObject({
      status: 502,
      code: 'unknown',
    });
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
  it("confirms and removes a connected tab with the app's key", async () => {
    const { seen, doFetch } = fakeFetch(() => new Response(null, { status: 204 }));
    const app = createIndexAppClient({ app: 'livedesign', key: 'k', fetch: doFetch });
    await app.confirmConnection('h1', 'cn_1', 'tab 1');
    await app.removeConnection('h1', 'cn_1', 'tab 1');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'PUT https://www.liveworkspace.app/api/index/app/items/h1/connections/cn_1?tab=tab%201',
      'DELETE https://www.liveworkspace.app/api/index/app/items/h1/connections/cn_1?tab=tab%201',
    ]);
    expect(seen[1]!.headers.get('Authorization')).toBe('Bearer k');
    expect(seen[1]!.headers.get('X-Index-App')).toBe('livedesign');
  });

  it("keeps a refusal's Retry-After on the IndexError, and null without one", async () => {
    const answers = [
      Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '120' } }),
      Response.json({ error: 'rate_limited' }, { status: 429 }),
    ];
    const { doFetch } = fakeFetch(() => answers.shift()!);
    const app = createIndexAppClient({ app: 'livediagram', key: 'k', fetch: doFetch });
    await expect(app.pushSummary('i1', {}, 1)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfterMs: 120_000,
    });
    await expect(app.pushEvents('i1', [])).rejects.toMatchObject({ retryAfterMs: null });
    expect(new IndexError(500, 'x').retryAfterMs).toBeNull();
  });

  it("keeps a person's call's Retry-After too, and none from a stand-in response without headers", async () => {
    const { doFetch } = fakeFetch(() =>
      Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '5' } }),
    );
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await expect(client.getItem('i1')).rejects.toMatchObject({ retryAfterMs: 5_000 });
    const bare = (async () =>
      ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response) as typeof fetch;
    const app = createIndexAppClient({ app: 'livediagram', key: 'k', fetch: bare });
    await expect(app.pushSummary('i1', {}, 1)).rejects.toMatchObject({
      status: 503,
      retryAfterMs: null,
    });
  });

  it('throws a refused connection door', async () => {
    const { doFetch } = fakeFetch(() => Response.json({ error: 'unauthorized' }, { status: 401 }));
    const app = createIndexAppClient({ app: 'livedesign', key: 'k', fetch: doFetch });
    await expect(app.removeConnection('h1', 'cn_1', 't')).rejects.toMatchObject({ status: 401 });
  });

  it("asks where Community posts' items stand, with the app's key, and throws a refusal", async () => {
    const posts = [{ id: 'i1', code: 'ABC', owner: 'user_a' }];
    const { seen, doFetch } = fakeFetch(() =>
      Response.json({ states: [{ id: 'i1', state: 'away' }] }),
    );
    const app = createIndexAppClient({ app: 'livediagram', key: 'k', fetch: doFetch });
    expect(await app.communityStates(posts)).toEqual([{ id: 'i1', state: 'away' }]);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'https://www.liveworkspace.app/api/index/app/community/states',
      body: { posts },
    });
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer k');
    expect(seen[0]!.headers.get('X-Index-App')).toBe('livediagram');

    const refused = fakeFetch(() => Response.json({ error: 'unauthorized' }, { status: 401 }));
    const other = createIndexAppClient({ app: 'livediagram', key: 'k', fetch: refused.doFetch });
    await expect(other.communityStates(posts)).rejects.toMatchObject({ status: 401 });
  });
});

describe('retryAfterMsOf', () => {
  const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
  it('reads delta-seconds and an HTTP date', () => {
    expect(retryAfterMsOf('30', NOW)).toBe(30_000);
    expect(retryAfterMsOf(' 0 ', NOW)).toBe(0);
    expect(retryAfterMsOf(new Date(NOW + 90_000).toUTCString(), NOW)).toBe(90_000);
  });
  it('waits 0 for a date already past', () => {
    expect(retryAfterMsOf(new Date(NOW - 5_000).toUTCString(), NOW)).toBe(0);
  });
  it('is null for no header, an unreadable one, a negative one and a huge one', () => {
    for (const header of [
      null,
      undefined,
      '',
      '  ',
      'soon',
      '-5',
      '1.5e3',
      'Nope GMT',
      '9'.repeat(41),
    ])
      expect(retryAfterMsOf(header, NOW)).toBeNull();
  });
  it('reads a long run of digits up to its cap as a number, for the outbox to cap', () => {
    expect(retryAfterMsOf('9'.repeat(40), NOW)).toBeGreaterThan(1e40);
  });
});
