import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse, ItemsResponse } from '@liveplanner/api-schema';
import { itemPersonId, presetSetup } from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { RemovalGuard, type HeldRemoval } from '../plan-room/removal-guard-store';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// The mass-removal guard on the item routes (docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card
// removals"): deletes and Trash moves past the limit are held and logged, a board is never emptied in one run, a
// person may confirm and a token may not, and a stale client reconnecting after others' edits wipes nothing.

let sql: SqliteD1;
let clock: number;
let store: Map<string, unknown>;
let guard: RemovalGuard;

const setup = presetSetup('kanban');
const STATUS = setup.columns[0]!.status;
const TYPE = setup.addTypes?.[0] ?? 'task';

type Call = {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string;
  code?: string;
  token?: { id: string };
};

async function call<T = unknown>({
  method = 'POST',
  path,
  body,
  owner = 'owner',
  code,
  token,
}: Call) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/projects/d1${path}`, {
    env: sql.env,
    owner,
    ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(token ? { ...ctx, token } : ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

// `n` cards on the board, their ids in order.
async function cards(n: number, owner = 'owner', code?: string): Promise<string[]> {
  const items = Array.from({ length: n }, (_, i) => ({
    type: TYPE,
    fields: { title: `Card ${i + 1}`, status: STATUS },
  }));
  const res = await call<ItemsResponse>({ path: '/items/bulk', body: { items }, owner, code });
  expect(res.status).toBe(201);
  return res.body.items.map((i) => i.id);
}

const del = (id: string, extra: Partial<Call> = {}) =>
  call({ method: 'DELETE', path: `/items/${id}`, ...extra });
const held = () => guard.held();
const stored = async () =>
  (await db.listItems(sql.env, 'd1')).filter((i) => i.fields.status !== 'trash');

beforeEach(() => {
  sql = sqliteD1();
  clock = 1_000_000;
  store = new Map();
  guard = new RemovalGuard(
    {
      get: async <T>(k: string) => store.get(k) as T | undefined,
      put: async <T>(k: string, v: T) => void store.set(k, v),
    },
    () => clock,
  );
  const env = sql.env as unknown as Record<string, unknown>;
  env.REMOVAL_GUARD = guard;
  env.PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: { ...setup, title: 'Sprint Board' },
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('bob', 'Bob', '#22c55e');
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
  `);
});

describe('deletes', () => {
  it('holds the delete that takes a run past the limit, and logs it', async () => {
    const ids = await cards(30);
    for (const id of ids.slice(0, 10)) expect((await del(id)).status).toBe(204);
    const res = await del(ids[10]!);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'removal_held',
      reason: 'over-threshold',
      board: 'Sprint Board',
      count: 11,
      limit: 10,
      message:
        'This would remove 11 of the 30 cards on Sprint Board at once, so it was held. Confirm it in liveplanner to go ahead.',
    });
    expect(await stored()).toHaveLength(20);
    const log = await held();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject<Partial<HeldRemoval>>({
      at: clock,
      actor: { kind: 'person', id: await itemPersonId('owner'), name: 'Webber' },
      cardIds: [ids[10]!],
      named: 1,
      reason: 'over-threshold',
    });
  });

  it('refuses the delete that would empty a board, whatever the limit', async () => {
    const ids = await cards(5);
    for (const id of ids.slice(0, 4)) expect((await del(id)).status).toBe(204);
    const res = await del(ids[4]!);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'removal_held', reason: 'empties-board' });
    expect(await stored()).toHaveLength(1);
  });

  it('lets a board of one or two cards be cleared', async () => {
    const ids = await cards(2);
    for (const id of ids) expect((await del(id)).status).toBe(204);
    expect(await stored()).toHaveLength(0);
  });

  it('starts a new run after a minute with no removal', async () => {
    const ids = await cards(30);
    for (const id of ids.slice(0, 10)) expect((await del(id)).status).toBe(204);
    clock += 60_000;
    expect((await del(ids[10]!)).status).toBe(204);
  });

  it('keeps each caller in a run of their own', async () => {
    const ids = await cards(60);
    for (const id of ids.slice(0, 10)) expect((await del(id)).status).toBe(204);
    expect((await del(ids[10]!, { owner: 'bob', code: 'EDIT' })).status).toBe(204);
  });

  it('never counts a card already gone', async () => {
    const ids = await cards(30);
    expect((await del('missing')).status).toBe(404);
    for (const id of ids.slice(0, 10)) expect((await del(id)).status).toBe(204);
    expect((await del(ids[10]!)).status).toBe(409);
  });
});

describe('the Trash', () => {
  const trashAll = (ids: string[], query = '', token?: { id: string }) =>
    call<ItemsResponse>({
      path: `/items/patches${query}`,
      body: { items: ids.map((id) => ({ id, set: { status: 'trash' } })) },
      token,
    });

  it('holds a many-patch that trashes past the limit, writing none of it', async () => {
    const ids = await cards(30);
    const res = await trashAll(ids.slice(0, 11));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'removal_held', count: 11 });
    expect(await stored()).toHaveLength(30);
    expect((await held())[0]?.cardIds).toEqual(ids.slice(0, 11));
    expect((await trashAll(ids.slice(0, 10))).status).toBe(200);
  });

  it('counts a single Trash move in the same run as deletes, and never a card already trashed', async () => {
    const ids = await cards(30);
    for (const id of ids.slice(0, 9)) expect((await del(id)).status).toBe(204);
    const trash = (id: string) =>
      call<ItemResponse>({ path: `/items/${id}`, body: { set: { status: 'trash' } } });
    expect((await trash(ids[9]!)).status).toBe(200);
    // Deleting it from the Trash takes nothing more off the board.
    expect((await del(ids[9]!)).status).toBe(204);
    expect((await trash(ids[10]!)).status).toBe(409);
  });

  it('holds a many-move into the Trash', async () => {
    const ids = await cards(30);
    const res = await call({
      path: '/items/moves',
      body: { items: ids.slice(0, 11).map((id) => ({ id, status: 'trash' })) },
    });
    expect(res.status).toBe(409);
    expect(await stored()).toHaveLength(30);
  });

  it('lets a person confirm a held removal, never a token', async () => {
    const ids = await cards(30);
    expect((await trashAll(ids.slice(0, 11), '?confirmRemoval=1', { id: 'tok_1' })).status).toBe(
      409,
    );
    expect((await held())[0]?.actor).toEqual({ kind: 'token', id: 'tok_1' });
    const res = await trashAll(ids.slice(0, 11), '?confirmRemoval=1');
    expect(res.status).toBe(200);
    expect(await stored()).toHaveLength(19);
  });
});

describe('a stale client reconnecting after others’ edits', () => {
  it('replays its queued deletes without wiping the board or the cards others added', async () => {
    // Owner's browser loads the board, then loses its connection with every card's delete queued (a stale or buggy
    // client): the replay names only the cards it knew.
    const known = await cards(30);
    // Meanwhile Bob, online, adds cards and edits one the stale client is about to delete.
    const added = await cards(5, 'bob', 'EDIT');
    const edit = await call<ItemResponse>({
      path: `/items/${known[3]}`,
      body: { set: { title: 'Edited by Bob' } },
      owner: 'bob',
      code: 'EDIT',
    });
    expect(edit.status).toBe(200);
    // Owner reconnects: the queue replays one delete at a time, in order.
    const answers: number[] = [];
    for (const id of known) answers.push((await del(id)).status);
    // The board had 35 cards: the first 10 land, every one after is held.
    expect(answers.filter((s) => s === 204)).toHaveLength(10);
    expect(answers.slice(10).every((s) => s === 409)).toBe(true);
    const left = (await stored()).map((i) => i.id);
    expect(left).toHaveLength(25);
    for (const id of added) expect(left).toContain(id);
    expect((await held()).length).toBe(20);
    // Bob's own tidy-up is his run, not the stale client's.
    expect((await del(added[0]!, { owner: 'bob', code: 'EDIT' })).status).toBe(204);
  });

  it('keeps the quarantine log to the last 50', async () => {
    const ids = await cards(80);
    for (const id of ids) await del(id);
    const log = await held();
    expect(log).toHaveLength(50);
    expect(log[49]?.cardIds).toEqual([ids[79]]);
  });
});
