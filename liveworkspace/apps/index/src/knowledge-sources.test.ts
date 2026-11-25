// Knowledge sources on the index (liveworkspace/docs/specs/004-index/knowledge-sources.md): what counts as a
// knowledgebase's source, its text read through its app's door, each reader's own access (never a connection's pass,
// never a guest), the likely look, and the change signal to the knowledgebases reading an item. Measured at a
// 500-item team.
import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeSourceListing } from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { knowledgeWatchers, signalKnowledgeSources } from './knowledge-sources';
import { body, call, h, person, settle, useHarness } from './test-support';

useHarness({
  INDEX_KEY_LIVEKNOWLEDGE: 'lk-key',
  APP_ORIGIN_LIVEKNOWLEDGE: 'https://www.liveknowledge.app',
});

const ADA = 'user_ada';
const BO = 'user_bo';

function addItem(
  id: string,
  owner: string,
  options: {
    app?: string;
    team?: string;
    folder?: string;
    trashed?: boolean;
    title?: string;
    summary?: string;
  } = {},
) {
  const app = options.app ?? 'livediagram';
  h.db.sql
    .prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at,
                          trashed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(
      id,
      app,
      app === 'liveplanner' ? 'plan' : 'canvas',
      owner,
      options.team ?? null,
      options.team ? `t:${options.team}` : `p:${owner}`,
      options.folder ?? null,
      options.title ?? id,
      options.summary ?? '{}',
      options.trashed ? 1 : null,
    );
}

function addFolder(id: string, owner: string, team: string | null, parent: string | null = null) {
  h.db.sql
    .prepare(
      `INSERT INTO folders (id, name, parent_id, owner_id, team_id, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
    )
    .run(id, id, parent, owner, team, team ? `t:${team}` : `p:${owner}`);
}

let connections = 0;
function connect(host: string, target: string, confirmed = true) {
  h.db.sql
    .prepare(
      `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, created_at, confirmed_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .run(`cn_${++connections}`, host, `tab-${connections}`, target, confirmed ? 2 : null);
}

const post = (kb: string, route: string, input: unknown, auth = 'lk-key', app = 'liveknowledge') =>
  call(`/app/items/${kb}/${route}`, {
    method: 'POST',
    auth,
    headers: { 'X-Index-App': app },
    body: input,
  });

// Ada's knowledgebase with a connected diagram and plan, a connected one not yet confirmed, a document of another
// app kind (liveknowledge itself) and an unconnected diagram of hers.
function arrange() {
  addItem('kb', ADA, { app: 'liveknowledge' });
  addItem('diagram', ADA, { title: 'Checkout Flow' });
  addItem('plan', ADA, { app: 'liveplanner', title: 'Launch Plan' });
  addItem('pending', ADA);
  addItem('other-kb', ADA, { app: 'liveknowledge' });
  addItem('loose', ADA, { title: 'Payments Architecture' });
  connect('kb', 'diagram');
  connect('kb', 'plan');
  connect('kb', 'pending', false);
  connect('kb', 'other-kb');
}

describe('knowledge-sources', () => {
  it('lists the confirmed connections in source apps, and only for liveknowledge', async () => {
    arrange();
    const res = await post('kb', 'knowledge-sources', {});
    expect(res.status).toBe(200);
    const { sources } = await body<{ sources: KnowledgeSourceListing[] }>(res);
    expect(sources.map((s) => [s.itemId, s.app, s.origin]).sort()).toEqual([
      ['diagram', 'livediagram', 'connected'],
      ['plan', 'liveplanner', 'connected'],
    ]);
    expect((await post('kb', 'knowledge-sources', {}, 'lp-key', 'liveplanner')).status).toBe(404);
    expect((await post('diagram', 'knowledge-sources', {})).status).toBe(404);
  });

  it("adds a team folder's tree in the knowledgebase's own scope, never another scope's folder", async () => {
    addItem('kb', ADA, { app: 'liveknowledge', team: 'T' });
    addFolder('f', ADA, 'T');
    addFolder('f-inner', ADA, 'T', 'f');
    addFolder('mine', ADA, null);
    addItem('in-top', ADA, { team: 'T', folder: 'f' });
    addItem('in-inner', ADA, { app: 'livehuddle', team: 'T', folder: 'f-inner' });
    addItem('binned', ADA, { team: 'T', folder: 'f', trashed: true });
    addItem('personal', ADA, { folder: 'mine' });
    const read = async (folderId: string) =>
      (
        await body<{ sources: KnowledgeSourceListing[] }>(
          await post('kb', 'knowledge-sources', { folderId }),
        )
      ).sources;
    expect((await read('f')).map((s) => [s.itemId, s.origin]).sort()).toEqual([
      ['in-inner', 'folder'],
      ['in-top', 'folder'],
    ]);
    expect(await read('mine')).toEqual([]);
  });
});

describe('knowledge-text', () => {
  const TEXT = { name: 'Checkout Flow', version: 4, chunks: [] };

  it("reads a source through its app's door on the index's key", async () => {
    arrange();
    h.appAnswer = () => Response.json(TEXT);
    const res = await post('kb', 'knowledge-text', { itemId: 'diagram' });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual(TEXT);
    const door = h.appCalls.find((c) => c.url.endsWith('/knowledge-text'));
    expect(door?.url).toBe('https://www.livediagram.app/api/internal/items/diagram/knowledge-text');
    expect(door?.headers.get('Authorization')).toBe('Bearer ld-key');
  });

  it('is missing for an item that is no source, gone or unanswered, and 503 when the app fails', async () => {
    arrange();
    h.appAnswer = (c) =>
      c.url.includes('/plan/')
        ? new Response('{}', { status: 404 })
        : new Response('x', { status: 500 });
    expect((await post('kb', 'knowledge-text', { itemId: 'loose' })).status).toBe(404);
    expect((await post('kb', 'knowledge-text', { itemId: 'pending' })).status).toBe(404);
    expect((await post('kb', 'knowledge-text', { itemId: 'nope' })).status).toBe(404);
    expect((await post('kb', 'knowledge-text', { itemId: 'a/b' })).status).toBe(400);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await post('kb', 'knowledge-text', { itemId: 'diagram' })).status).toBe(503);
  });
});

describe('the routes', () => {
  it("read a team folder's source, and answer only a POST to a known route", async () => {
    addItem('kb', ADA, { app: 'liveknowledge', team: 'T' });
    addFolder('f', ADA, 'T');
    addItem('filed', ADA, { team: 'T', folder: 'f' });
    addItem('elsewhere', ADA, { team: 'T' });
    h.appAnswer = () => Response.json({ name: 'Brand', version: 1, chunks: [] });
    expect((await post('kb', 'knowledge-text', { itemId: 'filed', folderId: 'f' })).status).toBe(
      200,
    );
    expect((await post('kb', 'knowledge-text', { itemId: 'filed' })).status).toBe(404);
    expect(
      (await post('kb', 'knowledge-text', { itemId: 'elsewhere', folderId: 'f' })).status,
    ).toBe(404);
    expect((await post('kb', 'knowledge-nope', {})).status).toBe(404);
    const get = await call('/app/items/kb/knowledge-sources', {
      auth: 'lk-key',
      headers: { 'X-Index-App': 'liveknowledge' },
    });
    expect(get.status).toBe(404);
    // A body that is no object reads as none; teams that are no list as none.
    expect((await post('kb', 'knowledge-sources', 'x')).status).toBe(200);
    expect(
      await body(
        await post('kb', 'knowledge-reach', {
          personId: BO,
          teams: 'T',
          itemIds: ['filed'],
          folderId: 'f',
        }),
      ),
    ).toEqual({ itemIds: [] });
  });
});

describe('knowledge-reach', () => {
  const reach = async (
    personId: string,
    itemIds: string[],
    teams: string[] = [],
    folderId?: string,
  ) =>
    (
      await body<{ itemIds: string[] }>(
        await post('kb', 'knowledge-reach', {
          personId,
          teams,
          itemIds,
          ...(folderId ? { folderId } : {}),
        }),
      )
    ).itemIds.sort();

  it("keeps each reader to the items they can open themselves, never through the connection's pass", async () => {
    arrange();
    // Bo's diagram, connected to Ada's knowledgebase: Ada reaches it only if she can open it herself.
    addItem('bos', BO);
    connect('kb', 'bos');
    expect(await reach(ADA, ['diagram', 'plan', 'bos', 'loose', 'other-kb'])).toEqual([
      'diagram',
      'loose',
      'plan',
    ]);
    expect(await reach(BO, ['diagram', 'plan', 'bos'])).toEqual(['bos']);
    expect(await reach('guest_x', ['diagram'])).toEqual([]);
    expect(await reach(ADA, [])).toEqual([]);
    expect((await post('kb', 'knowledge-reach', { personId: ADA, itemIds: 'x' })).status).toBe(400);
  });

  it("reaches a team's items through the reader's own membership", async () => {
    addItem('kb', ADA, { app: 'liveknowledge', team: 'T' });
    addFolder('f', ADA, 'T');
    addItem('team-diagram', ADA, { team: 'T', folder: 'f' });
    expect(await reach(BO, ['team-diagram'], [], 'f')).toEqual([]);
    expect(await reach(BO, ['team-diagram'], ['T'], 'f')).toEqual(['team-diagram']);
  });
});

describe('knowledge-likely', () => {
  it("finds the reader's own items of the scope by title, leaving out sources and others' items", async () => {
    arrange();
    addItem('bos-pay', BO, { title: 'Payments Runbook' });
    const res = await post('kb', 'knowledge-likely', {
      personId: ADA,
      teams: [],
      words: ['payments', 'xx', 'architecture'],
      exclude: ['diagram', 'plan'],
    });
    expect(await body(res)).toEqual({
      items: [{ itemId: 'loose', app: 'livediagram', title: 'Payments Architecture' }],
    });
    // LIKE's own characters match as written.
    expect(
      await body(
        await post('kb', 'knowledge-likely', {
          personId: ADA,
          teams: [],
          words: ['%%%'],
          exclude: [],
        }),
      ),
    ).toEqual({ items: [] });
    // A Japanese question has no spaces, so it is one word: 20 letters are 60 bytes, past D1's 50-byte LIKE pattern.
    addItem('ja', ADA, { title: 'デプロイの手順はどこに書いてありますかを確認する' });
    expect(
      await body(
        await post('kb', 'knowledge-likely', {
          personId: ADA,
          teams: [],
          words: ['デプロイの手順はどこに書いてありますか'],
          exclude: [],
        }),
      ),
    ).toEqual({
      items: [
        {
          itemId: 'ja',
          app: 'livediagram',
          title: 'デプロイの手順はどこに書いてありますかを確認する',
        },
      ],
    });
    expect(
      await body(
        await post('kb', 'knowledge-likely', {
          personId: 'guest_1',
          teams: [],
          words: ['payments'],
        }),
      ),
    ).toEqual({ items: [] });
  });
});

describe('the change signal', () => {
  it('tells the knowledgebases connected to an item, and team knowledgebases reading its folder', async () => {
    arrange();
    addItem('team-kb', ADA, {
      app: 'liveknowledge',
      team: 'T',
      summary: JSON.stringify({ knowledgeFolder: 'top' }),
    });
    addFolder('top', ADA, 'T');
    addFolder('inner', ADA, 'T', 'top');
    addItem('filed', ADA, { team: 'T', folder: 'inner' });
    connect('kb', 'filed');
    expect(
      (
        await knowledgeWatchers(h.db.env, {
          id: 'filed',
          app: 'livediagram',
          scope: 't:T',
          team_id: 'T',
          folder_id: 'inner',
        })
      ).sort(),
    ).toEqual(['kb', 'team-kb']);
    // A plan in no folder, read by no knowledgebase: nobody.
    expect(
      await knowledgeWatchers(h.db.env, {
        id: 'loose',
        app: 'livediagram',
        scope: `p:${ADA}`,
        team_id: null,
        folder_id: null,
      }),
    ).toEqual([]);
    h.appCalls = [];
    await signalKnowledgeSources(h.db.env, 'filed', true);
    const told = h.appCalls.filter((c) => c.url.endsWith('/knowledge-source-changed'));
    expect(told.map((c) => c.url).sort()).toEqual([
      'https://www.liveknowledge.app/api/internal/items/kb/knowledge-source-changed',
      'https://www.liveknowledge.app/api/internal/items/team-kb/knowledge-source-changed',
    ]);
    expect(told[0]!.body).toEqual({ app: 'livediagram', itemId: 'filed', gone: true });
    expect(told[0]!.headers.get('Authorization')).toBe('Bearer lk-key');
  });

  it('says nothing for a knowledgebase itself or an item gone', async () => {
    arrange();
    h.appCalls = [];
    await signalKnowledgeSources(h.db.env, 'kb');
    await signalKnowledgeSources(h.db.env, 'nope');
    expect(h.appCalls).toEqual([]);
  });

  it("signals on a source's summary push that moves it on, and on trash", async () => {
    arrange();
    h.appCalls = [];
    const push = (updatedAt: number) =>
      call('/app/items/diagram/summary', {
        method: 'PUT',
        auth: 'ld-key',
        headers: { 'X-Index-App': 'livediagram' },
        body: { summary: { kind: 'canvas', tabs: [] }, updatedAt },
      });
    expect((await push(50)).status).toBeLessThan(300);
    await settle();
    expect(h.appCalls.filter((c) => c.url.endsWith('/kb/knowledge-source-changed'))).toHaveLength(
      1,
    );
    h.appCalls = [];
    // The same save again moves nothing.
    await push(50);
    await settle();
    expect(h.appCalls.filter((c) => c.url.endsWith('/knowledge-source-changed'))).toHaveLength(0);
  });
});

describe('trash', () => {
  it('tells the knowledgebases reading an item that it is gone', async () => {
    arrange();
    const ada = await person(ADA);
    h.appCalls = [];
    expect(
      (await call('/items/diagram', { method: 'DELETE', auth: ada.auth })).status,
    ).toBeLessThan(300);
    await settle();
    const told = h.appCalls.filter((c) => c.url.endsWith('/kb/knowledge-source-changed'));
    expect(told.map((c) => c.body)).toEqual([
      { app: 'livediagram', itemId: 'diagram', gone: true },
    ]);
  });
});

describe('at a 500-item team', () => {
  it('lists, reaches and finds within a CPU budget', async () => {
    addItem('kb', ADA, { app: 'liveknowledge', team: 'T' });
    addFolder('f0', ADA, 'T');
    for (let d = 1; d < 8; d++) addFolder(`f${d}`, ADA, 'T', `f${d - 1}`);
    const apps = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'];
    for (let i = 0; i < 500; i++) {
      addItem(`item${i}`, ADA, {
        app: apps[i % 5],
        team: 'T',
        folder: `f${i % 8}`,
        title: `Item ${i} payments`,
      });
      if (i < 100) connect('kb', `item${i}`);
    }
    let sources: KnowledgeSourceListing[] = [];
    const listMs = await cpuMsOfAsync(async () => {
      sources = (
        await body<{ sources: KnowledgeSourceListing[] }>(
          await post('kb', 'knowledge-sources', { folderId: 'f0' }),
        )
      ).sources;
    });
    expect(sources).toHaveLength(500);
    let reached: string[] = [];
    const reachMs = await cpuMsOfAsync(async () => {
      reached = (
        await body<{ itemIds: string[] }>(
          await post('kb', 'knowledge-reach', {
            personId: BO,
            teams: ['T'],
            itemIds: Array.from({ length: 24 }, (_, i) => `item${i * 20}`),
            folderId: 'f0',
          }),
        )
      ).itemIds;
    });
    expect(reached).toHaveLength(24);
    const likelyMs = await cpuMsOfAsync(async () => {
      await post('kb', 'knowledge-likely', {
        personId: BO,
        teams: ['T'],
        words: ['payments'],
        exclude: [],
      });
    });
    console.info('[measure] 500-item team', { listMs, reachMs, likelyMs });
    expect(listMs).toBeLessThan(cpuBudgetMs(250));
    expect(reachMs).toBeLessThan(cpuBudgetMs(100));
    expect(likelyMs).toBeLessThan(cpuBudgetMs(100));
  });
});
