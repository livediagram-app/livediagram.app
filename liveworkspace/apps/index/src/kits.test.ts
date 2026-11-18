// Project kits over HTTP (liveworkspace/docs/specs/004-index/kits.md): who may start one, a run's folder, parts and
// connections both ways, the role the passes take, a partial failure and its Retry, and Remove What Was Made.
import { kitById, type KitRun } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

const APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'] as const;
useHarness(
  Object.fromEntries(
    APPS.flatMap((app) => [
      [`INDEX_KEY_${app.toUpperCase()}`, `${app}-key`],
      [`APP_ORIGIN_${app.toUpperCase()}`, `https://${app}.app`],
    ]),
  ),
);

const rows = <T = Record<string, unknown>>(sql: string, ...args: string[]) =>
  h.db.sql.prepare(sql).all(...args) as T[];

const appOf = (c: AppCall) => new URL(c.url).hostname.replace(/\.app$/, '');
const doorCalls = () => h.appCalls.filter((c) => c.url.endsWith('/items/from-template'));
const tabCalls = () => h.appCalls.filter((c) => c.url.endsWith('/connected-tabs'));

type Doors = {
  // An app whose template door fails.
  failMake?: Set<string>;
  // An app whose connected tab door fails.
  failTab?: Set<string>;
};

// The apps' doors, answering as the apps do: the template door makes the person's item in the folder through the
// index's own create, and the connected tab door names a new tab.
function answerDoors(auth: string, doors: Doors = {}) {
  let tab = 0;
  h.appAnswer = async (c) => {
    const app = appOf(c);
    if (c.url.endsWith('/items/from-template')) {
      if (doors.failMake?.has(app)) return new Response(null, { status: 503 });
      const input = c.body as { folderId: string; name: string };
      const item = await makeItem(auth, { app, title: input.name, folderId: input.folderId });
      return Response.json({ id: item.id }, { status: 201 });
    }
    if (c.url.endsWith('/connected-tabs')) {
      if (doors.failTab?.has(app)) return new Response(null, { status: 503 });
      tab += 1;
      return Response.json({ tabId: `tab-${tab}` }, { status: 201 });
    }
    return new Response(null, { status: 200 });
  };
}

const start = (auth: string | null, input: Record<string, unknown>) =>
  call('/kits', { method: 'POST', auth, body: input });

const remove = (auth: string, input: Record<string, unknown>) =>
  call('/kits/remove', { method: 'POST', auth, body: input });

const madeOf = (run: KitRun) =>
  Object.fromEntries(run.parts.flatMap((p) => (p.itemId ? [[p.slot, p.itemId]] : [])));

const SOFTWARE = { kit: 'software-project', level: 'edit', name: 'Apollo' };

describe('who may start a kit', () => {
  it('refuses a guest with sign_in_required, and nobody at all', async () => {
    const guest = await person('guest_g1', { guest: true });
    const res = await start(guest.auth, SOFTWARE);
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: 'sign_in_required' });
    expect((await start(null, SOFTWARE)).status).toBe(401);
    expect(h.appCalls).toEqual([]);
  });

  it('refuses an app acting for a person', async () => {
    const res = await call('/kits', {
      method: 'POST',
      auth: 'liveplanner-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_a' },
      body: SOFTWARE,
    });
    expect(res.status).toBe(403);
    expect(doorCalls()).toEqual([]);
  });

  it('answers another method or path 404, and a malformed body 400', async () => {
    const ada = await person('user_a');
    expect((await call('/kits', { auth: ada.auth })).status).toBe(404);
    expect((await call('/kits/nope', { method: 'POST', auth: ada.auth, body: {} })).status).toBe(
      404,
    );
    expect((await start(ada.auth, { ...SOFTWARE, kit: 'nope' })).status).toBe(400);
    expect((await remove(ada.auth, {})).status).toBe(400);
    expect(rows('SELECT * FROM folders')).toEqual([]);
  });
});

describe('starting a kit', () => {
  it('makes every part in a new folder, connected both ways, in one click', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth);
    const res = await start(ada.auth, SOFTWARE);
    expect(res.status).toBe(200);
    const run = await body<KitRun>(res);
    expect(run.complete).toBe(true);
    expect(run.connections).toEqual({ made: 12, failed: 0 });

    const [folder] = rows<{ id: string; name: string; parent_id: string | null }>(
      'SELECT * FROM folders',
    );
    expect(folder).toMatchObject({ id: run.folderId, name: 'Apollo', parent_id: null });
    const kit = kitById('software-project');
    expect(doorCalls().map((c) => [appOf(c), c.body])).toEqual(
      kit.parts.map((p) => [
        p.app,
        { owner: 'user_a', folderId: run.folderId, name: `Apollo ${p.name}`, template: p.template },
      ]),
    );
    const items = rows<{ id: string; folder_id: string; title: string }>(
      'SELECT id, folder_id, title FROM items',
    );
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.folder_id === run.folderId)).toBe(true);

    // Every ordered pair: confirmed, with its tab, joined to its other direction.
    const connections = rows<{
      id: string;
      host_item_id: string;
      target_item_id: string;
      host_tab_id: string;
      pair_id: string;
      confirmed_at: number | null;
    }>('SELECT * FROM connections');
    expect(connections).toHaveLength(12);
    const byId = new Map(connections.map((c) => [c.id, c]));
    for (const c of connections) {
      expect(c.confirmed_at).not.toBeNull();
      expect(c.host_tab_id).toMatch(/^tab-\d+$/);
      const pair = byId.get(c.pair_id)!;
      expect([pair.host_item_id, pair.target_item_id]).toEqual([c.target_item_id, c.host_item_id]);
    }
    // Each host's tabs in the kit's order of its targets.
    const ids = run.parts.map((p) => p.itemId!);
    const planTabs = tabCalls().filter((c) => c.url.includes(ids[0]!));
    expect(
      planTabs.map((c) => (c.body as { connection: { itemId: string } }).connection.itemId),
    ).toEqual(ids.slice(1));
    expect(planTabs.map((c) => (c.body as { name: string }).name)).toEqual([
      'Apollo Architecture',
      'Apollo Design Doc',
      'Apollo Team Space',
    ]);
    expect(rows("SELECT * FROM events WHERE type = 'shared'")).toHaveLength(12);
    await settle();
    // No first-share notices for a kit's own passes.
    expect(h.appCalls.filter((c) => c.url.endsWith('/notices'))).toEqual([]);
  });

  it('gives every pass the role chosen, and livehuddle its nearest when it has no Viewer', async () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      const ada = await person(`user_${level}`);
      answerDoors(ada.auth);
      const run = await body<KitRun>(await start(ada.auth, { ...SOFTWARE, level }));
      const space = run.parts.find((p) => p.app === 'livehuddle')!.itemId!;
      const passes = rows<{ item_id: string; level: string }>(
        `SELECT s.item_id, s.level FROM share_links s JOIN connections c ON c.share_code = s.code
          JOIN items i ON i.id = c.host_item_id WHERE i.owner_id = ?`,
        ada.id,
      );
      expect(passes).toHaveLength(12);
      for (const pass of passes)
        expect(pass.level).toBe(pass.item_id === space && level === 'view' ? 'participate' : level);
    }
  });
});

describe('a partial failure', () => {
  it('reports the parts not made, and Retry makes only those and the missing connections', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth, { failMake: new Set(['livehuddle']) });
    const first = await body<KitRun>(await start(ada.auth, SOFTWARE));
    expect(first.complete).toBe(false);
    expect(first.parts.find((p) => p.slot === 'space')!.itemId).toBeNull();
    expect(first.connections).toEqual({ made: 6, failed: 0 });

    answerDoors(ada.auth);
    h.appCalls = [];
    const retry = await body<KitRun>(
      await start(ada.auth, { ...SOFTWARE, folderId: first.folderId, made: madeOf(first) }),
    );
    expect(retry.complete).toBe(true);
    expect(retry.folderId).toBe(first.folderId);
    expect(doorCalls().map(appOf)).toEqual(['livehuddle']);
    expect(retry.connections).toEqual({ made: 6, failed: 0 });
    expect(rows('SELECT * FROM connections')).toHaveLength(12);
    expect(rows('SELECT * FROM folders')).toHaveLength(1);
  });

  it('takes back a connection whose tab could not be written, and Retry makes it', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth, { failTab: new Set(['livedocuments']) });
    const first = await body<KitRun>(await start(ada.auth, SOFTWARE));
    expect(first.complete).toBe(false);
    expect(first.connections).toEqual({ made: 9, failed: 3 });
    // Nothing of a failed tab's is left: no row, no pass.
    expect(rows('SELECT * FROM connections')).toHaveLength(9);
    expect(rows('SELECT * FROM share_links')).toHaveLength(9);
    expect(rows('SELECT * FROM connections WHERE confirmed_at IS NULL')).toEqual([]);

    answerDoors(ada.auth);
    h.appCalls = [];
    const retry = await body<KitRun>(
      await start(ada.auth, { ...SOFTWARE, folderId: first.folderId, made: madeOf(first) }),
    );
    expect(doorCalls()).toEqual([]);
    expect(retry).toMatchObject({ complete: true, connections: { made: 3, failed: 0 } });
    expect(rows('SELECT * FROM connections')).toHaveLength(12);
  });

  it('counts a door’s answer naming no item of the person’s as not made, and connects nothing alone', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth, { failMake: new Set(['liveplanner', 'livedocuments']) });
    const answer = h.appAnswer;
    h.appAnswer = (c) =>
      appOf(c) === 'livehuddle' && c.url.endsWith('/items/from-template')
        ? Response.json({ id: '../nope' }, { status: 201 })
        : answer(c);
    const run = await body<KitRun>(await start(ada.auth, SOFTWARE));
    expect(run.parts.filter((p) => p.itemId).map((p) => p.app)).toEqual(['livediagram']);
    expect(run).toMatchObject({ complete: false, connections: { made: 0, failed: 0 } });
    expect(tabCalls()).toEqual([]);
  });

  it('remakes a part named on Retry that is not the person’s own in the folder', async () => {
    const ada = await person('user_a');
    const bo = await person('user_b');
    const bos = await makeItem(bo.auth, { app: 'livehuddle', title: 'Not Ada’s' });
    answerDoors(ada.auth, { failMake: new Set(['livehuddle']) });
    const first = await body<KitRun>(await start(ada.auth, SOFTWARE));
    answerDoors(ada.auth);
    h.appCalls = [];
    const retry = await body<KitRun>(
      await start(ada.auth, {
        ...SOFTWARE,
        folderId: first.folderId,
        made: { ...madeOf(first), space: bos.id },
      }),
    );
    expect(doorCalls().map(appOf)).toEqual(['livehuddle']);
    expect(retry.parts.find((p) => p.slot === 'space')!.itemId).not.toBe(bos.id);
  });

  it('refuses a Retry into a folder not the person’s own', async () => {
    const ada = await person('user_a');
    const bo = await person('user_b');
    answerDoors(bo.auth);
    const bos = await body<KitRun>(await start(bo.auth, SOFTWARE));
    h.appCalls = [];
    const res = await start(ada.auth, { ...SOFTWARE, folderId: bos.folderId, made: {} });
    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({ error: 'folder_not_found' });
    expect(doorCalls()).toEqual([]);
  });
});

describe('Remove What Was Made', () => {
  it('deletes the run’s items for good, and its folder once empty', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth, { failMake: new Set(['livehuddle']) });
    const run = await body<KitRun>(await start(ada.auth, SOFTWARE));
    h.appCalls = [];
    expect((await remove(ada.auth, { folderId: run.folderId, made: madeOf(run) })).status).toBe(
      204,
    );
    await settle();
    expect(rows('SELECT * FROM items')).toEqual([]);
    expect(rows('SELECT * FROM folders')).toEqual([]);
    expect(rows('SELECT * FROM connections')).toEqual([]);
    expect(rows('SELECT * FROM share_links')).toEqual([]);
  });

  it('leaves what is not the run’s: another’s item, and a folder something else is in', async () => {
    const ada = await person('user_a');
    const bo = await person('user_b');
    const bos = await makeItem(bo.auth, { app: 'livehuddle', title: 'Bo’s' });
    answerDoors(ada.auth);
    const run = await body<KitRun>(await start(ada.auth, SOFTWARE));
    const kept = await makeItem(ada.auth, { title: 'Notes', folderId: run.folderId });
    const made = { ...madeOf(run), space: bos.id };
    expect((await remove(ada.auth, { folderId: run.folderId, made })).status).toBe(204);
    expect(
      rows<{ id: string }>('SELECT id FROM items ORDER BY id')
        .map((r) => r.id)
        .sort(),
    ).toEqual([bos.id, kept.id, run.parts.find((p) => p.slot === 'space')!.itemId!].sort());
    expect(rows('SELECT * FROM folders')).toHaveLength(1);
  });

  it('removes an empty run’s folder when it made nothing', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth, {
      failMake: new Set(['livediagram', 'liveplanner', 'livedocuments', 'livehuddle']),
    });
    const run = await body<KitRun>(await start(ada.auth, SOFTWARE));
    expect(run.parts.every((p) => p.itemId === null)).toBe(true);
    expect((await remove(ada.auth, { folderId: run.folderId, made: {} })).status).toBe(204);
    expect(rows('SELECT * FROM folders')).toEqual([]);
  });

  it('refuses a folder not the person’s own', async () => {
    const ada = await person('user_a');
    const bo = await person('user_b');
    answerDoors(bo.auth);
    const bos = await body<KitRun>(await start(bo.auth, SOFTWARE));
    expect((await remove(ada.auth, { folderId: bos.folderId, made: madeOf(bos) })).status).toBe(
      404,
    );
    expect(rows('SELECT * FROM items')).toHaveLength(4);
  });
});

describe('the run limit', () => {
  // A stand-in for KIT_RUN_LIMITER: the first `allowed` calls pass, then every one is over.
  const limiter = (allowed: number) => {
    const keys: string[] = [];
    return {
      keys,
      env: {
        ...h.db.env,
        KIT_RUN_LIMITER: {
          limit: async ({ key }: { key: string }) => {
            keys.push(key);
            return { success: keys.length <= allowed };
          },
        },
      },
    };
  };

  it('answers 429 with Retry-After past the limit, per person, before anything is made', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth);
    const { keys, env } = limiter(1);
    const first = await call('/kits', { method: 'POST', auth: ada.auth, body: SOFTWARE, env });
    expect(first.status).toBe(200);
    const run = await body<KitRun>(first);
    const made = rows('SELECT id FROM items').length;
    const folders = rows('SELECT id FROM folders').length;

    // A Retry counts as a run, and is refused as one.
    const retry = await call('/kits', {
      method: 'POST',
      auth: ada.auth,
      body: { ...SOFTWARE, folderId: run.folderId, made: madeOf(run) },
      env,
    });
    expect(retry.status).toBe(429);
    expect(retry.headers.get('Retry-After')).toBe('60');
    expect(await body(retry)).toEqual({ error: 'rate_limited' });
    const again = await call('/kits', { method: 'POST', auth: ada.auth, body: SOFTWARE, env });
    expect(again.status).toBe(429);
    expect(rows('SELECT id FROM items')).toHaveLength(made);
    expect(rows('SELECT id FROM folders')).toHaveLength(folders);
    expect(keys).toEqual(['kit:user_a', 'kit:user_a', 'kit:user_a']);
  });

  it('leaves Remove What Was Made unlimited', async () => {
    const ada = await person('user_a');
    answerDoors(ada.auth);
    const run = await body<KitRun>(await start(ada.auth, SOFTWARE));
    const { keys, env } = limiter(0);
    const removed = await call('/kits/remove', {
      method: 'POST',
      auth: ada.auth,
      body: { folderId: run.folderId, made: madeOf(run) },
      env,
    });
    expect(removed.status).toBe(204);
    expect(keys).toEqual([]);
  });

  it('does not count a refused guest', async () => {
    const guest = await person('guest_g1', { guest: true });
    const { keys, env } = limiter(0);
    const res = await call('/kits', { method: 'POST', auth: guest.auth, body: SOFTWARE, env });
    expect(res.status).toBe(403);
    expect(keys).toEqual([]);
  });
});
