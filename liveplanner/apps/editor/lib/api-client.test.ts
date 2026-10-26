// @vitest-environment jsdom
import type { Tab } from '@liveplanner/project';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiCreateProject,
  apiDeleteTab,
  apiLoadProject,
  apiLoadShared,
  apiLoadTab,
  apiSaveProjectMeta,
  apiSaveTab,
  apiSharedTabs,
  setSessionSharePassword,
  setTokenProvider,
} from './api-client';
import { apiHeaders } from './api/core';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';
import { guestTokenFor } from './testing/guest-token';

// A plan's grant and the index are their own modules (plan-grants.test.ts, the index client's tests): here every
// request goes straight to the stubbed fetch, and the grant asked for is the one the test names.
const grants = vi.hoisted(() => ({
  planGrant: vi.fn(),
  planGrantRefusal: vi.fn(() => null as string | null),
}));
vi.mock('./api/plan-grants', () => ({
  withPlanGrant: async (_base: string, _input: string, init?: RequestInit) => init,
  heldPlanGrant: () => null,
  seedPlanGrant: () => {},
  planGrant: grants.planGrant,
  planGrantRefusal: grants.planGrantRefusal,
}));
const index = vi.hoisted(() => ({
  recordOpen: vi.fn(async () => {}),
  resolveShare: vi.fn(),
  createItem: vi.fn(async (input: { id: string }) => ({
    item: { id: input.id },
    grant: { grant: 'g', level: 'edit', tabId: null, expiresAt: Date.now() + 600_000 },
  })),
  updateItem: vi.fn(async () => ({ item: {} })),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: index,
  INDEX_BASE: '/api/index',
}));

// Reset the module-level token provider between tests so the order of
// the cases below doesn't leak. The Bearer-path tests register a
// provider, the guest-path tests assume none. Without this teardown a
// previous case's provider would silently drive a later "guest" case
// down the Bearer branch.
afterEach(() => {
  setTokenProvider(null);
  // Clear the session share password (docs/specs/013-workspace/share-password.md) so a password-path case
  // doesn't leak X-Share-Password into a later case's headers.
  setSessionSharePassword(null);
});

// Helper: apiHeaders returns HeadersInit which can be either a plain
// object or a Headers / [string, string][] tuple list. In this file
// every branch returns a plain object, so the cast is safe and the
// tests can treat the result as a Record for index assertions.
async function call(...args: Parameters<typeof apiHeaders>): Promise<Record<string, string>> {
  return (await apiHeaders(...args)) as Record<string, string>;
}

// Who a request is from (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests"): the account's token, else the
// guest's, both as the Bearer; a link visitor with neither sends no identity at all.
describe('apiHeaders', () => {
  afterEach(() => localStorage.clear());

  it('sends no identity without a token of either kind', async () => {
    const h = await call('guest_1');
    expect(h.Authorization).toBeUndefined();
    expect(h['X-Owner-Id']).toBeUndefined();
  });

  it('sends the guest token as the Bearer', async () => {
    const token = guestTokenFor('guest_1');
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
    expect((await call('guest_1')).Authorization).toBe(`Bearer ${token}`);
  });

  it('prefers the account token to the guest one', async () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestTokenFor('guest_1'));
    setTokenProvider(async () => 'jwt-token-abc');
    expect((await call('ignored')).Authorization).toBe('Bearer jwt-token-abc');
  });

  it('refuses an account id with no account token rather than sending it as a guest', async () => {
    setTokenProvider(async () => null);
    await expect(call('user_2abcdefghijklmnopqrstuvwxyz')).rejects.toThrow();
  });

  it('body opt adds Content-Type', async () => {
    expect((await call('guest_1', { body: true }))['Content-Type']).toBe('application/json');
  });

  it('share opt adds X-Share-Code, and null adds nothing', async () => {
    expect((await call('guest_1', { share: 'ABCD2345' }))['X-Share-Code']).toBe('ABCD2345');
    expect((await call('guest_1', { share: null }))['X-Share-Code']).toBeUndefined();
  });

  it('bearer + share: a signed-in visitor on a link still carries the code', async () => {
    setTokenProvider(async () => 'jwt-token-xyz');
    const h = await call('ignored', { share: 'IJKL0123' });
    expect(h.Authorization).toBe('Bearer jwt-token-xyz');
    expect(h['X-Share-Code']).toBe('IJKL0123');
  });

  it('attaches X-Share-Password once a session password is set (docs/specs/013-workspace/share-password.md)', async () => {
    expect((await call('guest_1'))['X-Share-Password']).toBeUndefined();
    setSessionSharePassword('hunter2');
    expect((await call('guest_1'))['X-Share-Password']).toBe('hunter2');
    setSessionSharePassword(null);
    expect((await call('guest_1'))['X-Share-Password']).toBeUndefined();
  });
});

// A link opens a plan at the level its grant says (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and
// access"): the index answers the grant, or why not; the plan is then read once.
describe('apiLoadShared', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionSharePassword(null);
    grants.planGrant.mockReset();
    grants.planGrantRefusal.mockReset().mockReturnValue(null);
  });

  const GRANT = {
    grant: 'g',
    level: 'participate',
    tabId: 'tab-2',
    expiresAt: Date.now() + 600_000,
  };

  it('asks for a password the link needs', async () => {
    grants.planGrant.mockResolvedValue(null);
    grants.planGrantRefusal.mockReturnValue('password_required');
    expect(await apiLoadShared('CODE2345', 'guest-1', 'p1')).toEqual({
      passwordRequired: true,
      invalid: false,
    });
  });

  it('says a wrong password was wrong', async () => {
    grants.planGrant.mockResolvedValue(null);
    grants.planGrantRefusal.mockReturnValue('password_invalid');
    expect(await apiLoadShared('CODE2345', 'guest-2', 'p1')).toEqual({
      passwordRequired: true,
      invalid: true,
    });
  });

  it('opens nothing for a revoked link', async () => {
    grants.planGrant.mockResolvedValue(null);
    grants.planGrantRefusal.mockReturnValue('not_found');
    expect(await apiLoadShared('CODE2345', 'guest-3', 'p1')).toBeNull();
  });

  it('reads the plan once, at the grant’s level and tab', async () => {
    grants.planGrant.mockResolvedValue(GRANT);
    stubFetch(200, { project: { id: 'p1' } });
    const res = await apiLoadShared('CODE2345', 'guest-4', 'p1');
    expect(res).toMatchObject({ project: { id: 'p1' }, role: 'participate', tabId: 'tab-2' });
    expect(grants.planGrant).toHaveBeenCalledWith(
      'p1',
      { code: 'CODE2345', password: null },
      { fresh: true },
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/projects/p1');
    expect(new Headers(init!.headers).get('X-Share-Code')).toBe('CODE2345');
  });

  it('resolves the code at the index when the address names no plan', async () => {
    index.resolveShare.mockResolvedValue({ item: { id: 'p9' } });
    grants.planGrant.mockResolvedValue(GRANT);
    stubFetch(200, { project: { id: 'p9' } });
    const res = await apiLoadShared('CODE9999', 'guest-5');
    expect(index.resolveShare).toHaveBeenCalledWith('CODE9999', null);
    expect(res).toMatchObject({ project: { id: 'p9' } });
  });
});

// Helper to stub the global fetch with a one-shot mocked Response.
// Each test reaches for its own fixture so the cases don't leak
// state through the shared Response object. `body` is plain JSON
// the helper stringifies; `status` defaults to 200.
function stubFetch(status: number, body: unknown = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

// `expectOk`, `expectOkOrNull`, `expectOkVoid`, and `expectOkOr404Void`
// are module-private helpers that every api function in this file
// passes its Response through. Their contract is observable from the
// outside via the api functions themselves, so the cases below pin
// each helper through a representative caller. A regression in any
// one of these helpers (e.g. the error message format changing, the
// 404-tolerance dropping, a missing await on res.json()) would
// silently break error reporting across every endpoint downstream.
describe('response helpers (observed through api callers)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('expectOkOrNull (via apiLoadProject)', () => {
    it('returns the parsed project on 200', async () => {
      // apiLoadProject is wrapped in dedupeInFlight keyed by
      // `${ownerId}|${id}`, so each test below uses a unique key
      // pair to avoid collecting a cached promise from a prior
      // case. Without unique keys, the second test in this block
      // would observe the first test's resolved value and the
      // fetch mock would never be consulted.
      const liveDoc = {
        id: 'd-200',
        name: 'Hello',
        createdAt: 0,
        updatedAt: 0,
        shareable: false,
        ownerId: 'o-200',
        tabs: [],
      };
      stubFetch(200, { project: liveDoc });
      const got = await apiLoadProject('o-200', 'd-200');
      expect(got).toEqual(liveDoc);
    });

    it('returns null on 404 (the load-doesnt-exist path)', async () => {
      // The 404 contract is what lets `/project/<unknown-id>`
      // surface the NotFound page instead of throwing into the
      // editor's load effect. A regression that re-threw 404
      // would tip every welcome flow + share-resolution into a
      // crash boundary.
      stubFetch(404, {});
      const got = await apiLoadProject('o-404', 'd-404');
      expect(got).toBeNull();
    });

    it('throws "load failed: <status>" on 500', async () => {
      stubFetch(500);
      await expect(apiLoadProject('o-500', 'd-500')).rejects.toThrow('load failed: 500');
    });
  });

  describe('expectOkVoid (via apiSaveProjectMeta)', () => {
    it('resolves quietly on 200 (no body to parse)', async () => {
      // apiSaveProjectMeta is a write with no response body. The
      // helper must NOT call res.json() or it would throw on an
      // empty body. Asserting the promise resolves without value
      // pins both the no-throw + no-body contract.
      stubFetch(200);
      await expect(
        apiSaveProjectMeta('owner', { id: 'd-1', name: 'New' }),
      ).resolves.toBeUndefined();
    });

    it('throws "save project meta failed: <status>" on 500', async () => {
      stubFetch(500);
      await expect(apiSaveProjectMeta('owner', { id: 'd-1', name: 'New' })).rejects.toThrow(
        'save project meta failed: 500',
      );
    });
  });
});

// Internal apiDelete helper, observed through a public caller: a DELETE that takes a `shareCode` (delete tab)
// must round-trip the code as an `X-Share-Code` request header, otherwise an edit-role visitor's delete would
// 403 server-side.
describe('apiDelete (internal, via public DELETE callers)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('share-code forwarding (X-Share-Code header)', () => {
    it('apiDeleteTab forwards a non-null shareCode as the X-Share-Code header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await apiDeleteTab('owner', 'diag-1', 'tab-1', 'SHARE2345');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Share-Code']).toBe('SHARE2345');
    });

    it('apiDeleteTab omits the X-Share-Code header when shareCode is null', async () => {
      // The owner-path DELETE never wants the share-code header set
      // (it would force the server's share-code branch instead of
      // the simpler owner check). Skipping the field at the call
      // site preserves that.
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await apiDeleteTab('owner', 'diag-1', 'tab-1', null);
      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Share-Code']).toBeUndefined();
    });
  });
});

describe('apiCreateProject persisted body (docs/specs/006-project/tab-folders.md)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('strips UI-only tab fields (templateChosen, folder) before POSTing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: { id: 'd1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    // A tab carrying the editor-only fields that must NOT reach tabs.data:
    // templateChosen (UI state) + folder (per-project link, docs/specs/006-project/tab-folders.md).
    const tab = {
      id: 't1',
      name: 'Tab',
      elements: [],
      templateChosen: true,
      folder: 'f1',
    } as unknown as Tab;

    const out = await apiCreateProject('owner', { id: 'd1', name: 'N', tabs: [tab] });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/projects$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { tabs: Record<string, unknown>[] };
    expect(body.tabs[0]).not.toHaveProperty('templateChosen');
    expect(body.tabs[0]).not.toHaveProperty('folder');
    expect(body.tabs[0]).toMatchObject({ id: 't1', name: 'Tab' });
    expect(out).toEqual({ id: 'd1' });
  });

  // liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items": the index makes the item first, and its grant lets the
  // content in; the placement is the index's, never the api's.
  it('creates the item at the index, then the content with its grant', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ project: { id: 'd2' } }));
    vi.stubGlobal('fetch', fetchSpy);
    await apiCreateProject('owner', {
      id: 'd2',
      name: 'N',
      tabs: [],
      folderId: 'f1',
      teamId: 'team1',
    });
    expect(index.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd2',
        app: 'liveplanner',
        title: 'N',
        folderId: 'f1',
        teamId: 'team1',
      }),
    );
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('X-Index-Grant')).toBe('g');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('folderId');
    expect(body).not.toHaveProperty('teamId');
  });

  // docs/specs/026-plan/item-types.md "The type catalogue": a copy's catalogue, or a Plan template's brought
  // types, ride the create; the built-ins (none given) send nothing.
  it('sends the type catalogue when one is given', async () => {
    const fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ project: { id: 'd1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const itemTypes = { version: 1, types: [] };
    await apiCreateProject('owner', { id: 'd1', name: 'N', tabs: [], itemTypes });
    await apiCreateProject('owner', { id: 'd2', name: 'N', tabs: [], itemTypes: null });
    const bodies = fetchSpy.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
    );
    expect(bodies[0]!.itemTypes).toEqual(itemTypes);
    expect(bodies[1]).not.toHaveProperty('itemTypes');
  });

  // docs/specs/029-sheets/sheet-store.md "Offline projects", "Copies": a sync, a duplicate and a Drive import all
  // hand over the project's sheets. The field was typed but never sent, so a synced project with a Sheet came up
  // short and kept its local copy, and a copy landed without its sheets.
  it('sends the sheet store when one is given', async () => {
    const fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ project: { id: 'd1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const sheets = [{ id: 's1', tabId: 't1', title: 'Responses', cells: [] }];
    await apiCreateProject('owner', { id: 'd1', name: 'N', tabs: [], sheets });
    await apiCreateProject('owner', { id: 'd2', name: 'N', tabs: [], sheets: [] });
    const bodies = fetchSpy.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
    );
    expect(bodies[0]!.sheets).toEqual(sheets);
    expect(bodies[1]).not.toHaveProperty('sheets');
  });
});

describe('apiCreateProject placement (docs/specs/013-workspace/folders.md "Placement on create")', () => {
  afterEach(() => vi.unstubAllGlobals());

  const sentBody = async (d: Parameters<typeof apiCreateProject>[1]) => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ project: { id: 'd1' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    await apiCreateProject('owner', d);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, unknown>;
  };

  it('files the team and folder at the index, not in the content body', async () => {
    const body = await sentBody({ id: 'd1', name: 'N', teamId: 't1', folderId: 'f1' });
    expect(index.createItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ teamId: 't1', folderId: 'f1' }),
    );
    expect(body).not.toHaveProperty('teamId');
    expect(body).not.toHaveProperty('folderId');
  });

  it('leaves placement out when none is chosen', async () => {
    const body = await sentBody({ id: 'd1', name: 'N' });
    expect(body).not.toHaveProperty('teamId');
    expect(body).not.toHaveProperty('folderId');
  });

  it('sends a null folder to the index as the root chosen on purpose (docs/specs/013-workspace/default-folders.md)', async () => {
    await sentBody({ id: 'd1', name: 'N', teamId: null, folderId: null });
    const input = index.createItem.mock.lastCall![0] as Record<string, unknown>;
    expect(input).not.toHaveProperty('teamId');
    expect(input).toHaveProperty('folderId', null);
  });

  it('carries the creation intent (docs/specs/013-workspace/default-folders.md)', async () => {
    const intent = { mode: 'plan', tabKind: 'board', templateFamily: 'kanban' } as const;
    const body = await sentBody({ id: 'd1', name: 'N', intent });
    expect(body.intent).toEqual(intent);
  });

  it('leaves the intent out when the create keeps a place', async () => {
    const body = await sentBody({ id: 'd1', name: 'N' });
    expect(body).not.toHaveProperty('intent');
  });

  it('leaves markUsed out: every making in the editor counts, the server default', async () => {
    expect(await sentBody({ id: 'd1', name: 'N' })).not.toHaveProperty('markUsed');
  });

  it('throws the refusal token for a refused placement', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'team_forbidden' }), { status: 403 }),
        ),
    );
    await expect(
      apiCreateProject('owner', { id: 'd1', name: 'N', teamId: 't1' }),
    ).rejects.toMatchObject({ status: 403, code: 'team_forbidden' });
  });
});

describe('apiSharedTabs (docs/specs/006-project/tab-project-many-to-many.md)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the counts for the delete confirmation', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ sharedTabs: { tabs: 2, projects: 3 } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const signal = new AbortController().signal;

    const out = await apiSharedTabs('owner', 'd1', signal);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/projects\/d1\/shared-tabs$/);
    expect(init.signal).toBe(signal);
    expect(out).toEqual({ tabs: 2, projects: 3 });
  });

  it('throws on a refused read, so the caller can open without the notice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));

    await expect(apiSharedTabs('owner', 'd1')).rejects.toThrow();
  });
});

describe('apiSaveTab persisted body + allow-empty (docs/specs/006-project/tab-folders.md)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubOk = () => {
    const spy = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', spy);
    return spy;
  };
  const tabWithUi = {
    id: 't1',
    name: 'Tab',
    elements: [],
    templateChosen: true,
    folder: 'f1',
  } as unknown as Tab;

  it('PUTs to the tab path with UI-only fields stripped from the body', async () => {
    const spy = stubOk();
    await apiSaveTab('owner', 'd1', tabWithUi);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/projects\/d1\/tabs\/t1$/);
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('templateChosen');
    expect(body).not.toHaveProperty('folder');
    expect(body).toMatchObject({ id: 't1', name: 'Tab' });
  });

  it('omits X-Allow-Empty by default and sets it to "1" when allowEmpty is passed', async () => {
    const noOpt = stubOk();
    await apiSaveTab('owner', 'd1', tabWithUi);
    const h1 = (noOpt.mock.calls[0]![1] as RequestInit).headers as Headers;
    expect(h1.get('X-Allow-Empty')).toBeNull();

    const withOpt = stubOk();
    await apiSaveTab('owner', 'd1', tabWithUi, null, { allowEmpty: true });
    const h2 = (withOpt.mock.calls[0]![1] as RequestInit).headers as Headers;
    expect(h2.get('X-Allow-Empty')).toBe('1');
  });
});

describe('apiLoadTab load boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null on 404', async () => {
    stubFetch(404, {});
    expect(await apiLoadTab('owner', 'd1', 't-404', null)).toBeNull();
  });

  it('strips server-only fields (projectId / orderIndex / updatedAt) from the tab', async () => {
    stubFetch(200, {
      tab: { id: 't1', name: 'T', elements: [], projectId: 'd1', orderIndex: 3, updatedAt: 123 },
    });
    const tab = await apiLoadTab('owner', 'd1', 't-strip', null);
    expect(tab).not.toBeNull();
    expect(tab).not.toHaveProperty('projectId');
    expect(tab).not.toHaveProperty('orderIndex');
    expect(tab).not.toHaveProperty('updatedAt');
    expect(tab).toMatchObject({ id: 't1', name: 'T' });
  });

  it('coerces a ragged table to a rectangle and leaves other elements untouched', async () => {
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 };
    const ragged = {
      id: 'tbl',
      type: 'table',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      cells: [['a', 'b'], ['c']],
    };
    stubFetch(200, { tab: { id: 't1', name: 'T', elements: [shape, ragged] } });
    const tab = await apiLoadTab('owner', 'd1', 't-table', null);
    const table = tab!.elements.find((e) => e.type === 'table') as { cells: string[][] };
    expect(table.cells.map((r) => r.length)).toEqual([2, 2]); // padded to the widest row
    expect(table.cells[1]).toEqual(['c', '']);
    expect(tab!.elements.find((e) => e.id === 's')).toEqual(shape); // unchanged
  });

  // liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Opens": only a read the editor declares counts, at the index.
  it('records an open at the index only when asked to', async () => {
    stubFetch(200, { tab: { id: 't1', name: 'T', elements: [] } });
    await apiLoadTab('owner', 'd1', 't-open', null, { open: true });
    expect(index.recordOpen).toHaveBeenCalledWith('d1', null);
    index.recordOpen.mockClear();
    stubFetch(200, { tab: { id: 't1', name: 'T', elements: [] } });
    await apiLoadTab('owner', 'd1', 't-plain', null);
    expect(index.recordOpen).not.toHaveBeenCalled();
  });

  it('keeps a marked load apart from an unmarked one in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ tab: { id: 't1', name: 'T', elements: [] } })),
    );
    await Promise.all([
      apiLoadTab('owner', 'd1', 't-both', null),
      apiLoadTab('owner', 'd1', 't-both', null, { open: true }),
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
