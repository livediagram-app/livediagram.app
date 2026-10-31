import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemHistoryResponse, ItemResponse } from '@liveplanner/api-schema';
import { itemPersonId, presetSetup, readTimeValue, type Item } from '@liveplanner/items';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// Time Spent through the api (docs/specs/026-plan/item-types.md "Time Spent"): POST /items/:id/time, each write made
// to the card as stored; who may track (Editors everything, Participants their own, Viewers nothing); two people's
// timers both counting; no history; and every other write refused for the field (`field_time_tracked`).

let sql: SqliteD1;
let relayed: unknown[];

type Who = { owner?: string | null; code?: string };

async function call<T = unknown>(method: string, path: string, body?: unknown, who: Who = {}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/projects/p1${path}`, {
    env: sql.env,
    owner: who.owner === undefined ? 'owner' : who.owner,
    ...(who.code ? { headers: { 'X-Share-Code': who.code } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const FIELD = 'f-spent';
const TYPES = {
  version: 1,
  types: [
    {
      id: 'task',
      label: 'Task',
      color: '#71717a',
      glyph: 'task',
      fields: ['f-plan', FIELD],
      custom: [
        { id: 'f-plan', label: 'Planned', kind: 'duration' },
        { id: FIELD, label: 'Time Spent', kind: 'duration', timeSpent: true },
      ],
    },
  ],
};
const EDITOR: Who = { owner: 'eddie', code: 'EDIT' };
const PART: Who = { owner: 'pat', code: 'PART' };
const OTHER_PART: Who = { owner: 'quin', code: 'PART' };
const VIEWER: Who = { owner: 'vee', code: 'LOOK' };

const time = (id: string, op: Record<string, unknown>, who: Who = {}, field = FIELD) =>
  call<ItemResponse & { error?: string; field?: string }>(
    'POST',
    `/items/${id}/time`,
    { field, ...op },
    who,
  );
const make = async (fields: Item['fields'] = { title: 'Login' }) =>
  (await call<ItemResponse>('POST', '/items', { type: 'task', fields })).body.item;
const valueOf = (item: Item) => readTimeValue(item.fields[FIELD]);

let clock = 1_800_000_000_000;
const later = (ms: number) => {
  clock += ms;
  vi.setSystemTime(clock);
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(init.body);
        return new Response(null, { status: 204 });
      },
    }),
  };
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('pat', 'Pat', '#16a34a');
  setTestProfile('quin', 'Quin', '#dc2626');
  setTestProfile('eddie', 'Eddie', '#7c3aed');
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
                VALUES ('p1', 'owner', 'Plan', 1, 1, 1)`);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(
    `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('p1', 't1', 0, 1)`,
  );
  testShareLink(sql, 'p1', 'PART', 'participate');
  testShareLink(sql, 'p1', 'LOOK', 'view');
  testShareLink(sql, 'p1', 'EDIT', 'edit');
  expect((await call('PUT', '/item-types', { itemTypes: TYPES })).status).toBe(200);
});

describe('tracking time', () => {
  it('starts a timer, keeps counting across reads, and stops it into an entry', async () => {
    const card = await make();
    const started = await time(card.id, { op: 'start', timer: 'timer001' }, PART);
    expect(started.status).toBe(200);
    const pat = await itemPersonId('pat');
    expect(valueOf(started.body.item).running).toEqual([{ id: 'timer001', by: pat, start: clock }]);
    // Last Edited stays: tracking time is no edit of the card.
    expect(started.body.item.updatedAt).toBe(card.updatedAt);
    expect(relayed.length).toBeGreaterThan(0);
    // A reload (another device) reads the same start.
    later(45 * 60_000);
    const read = await call<{ items: Item[] }>('GET', '/items', undefined, PART);
    expect(valueOf(read.body.items[0]!).running[0]!.start).toBe(clock - 45 * 60_000);
    const stopped = await time(card.id, { op: 'stop', timer: 'timer001', entry: 'entry001' }, PART);
    expect(valueOf(stopped.body.item)).toMatchObject({
      people: { [pat]: { name: 'Pat' } },
      entries: [{ id: 'entry001', by: pat, minutes: 45, at: clock }],
      running: [],
    });
    // Stopped again (another device first): nothing changes, rev -1.
    const again = await time(card.id, { op: 'stop', timer: 'timer001', entry: 'entry002' }, PART);
    expect(again.status).toBe(200);
    expect(again.body.rev).toBe(-1);
  });

  it('counts two people’s concurrent timers both', async () => {
    const card = await make();
    await time(card.id, { op: 'start', timer: 'timer001' }, PART);
    later(5 * 60_000);
    await time(card.id, { op: 'start', timer: 'timer002' }, OTHER_PART);
    later(25 * 60_000);
    await time(card.id, { op: 'stop', timer: 'timer001', entry: 'entry001' }, PART);
    later(10 * 60_000);
    const last = await time(
      card.id,
      { op: 'stop', timer: 'timer002', entry: 'entry002' },
      OTHER_PART,
    );
    expect(valueOf(last.body.item).entries.map((e) => e.minutes)).toEqual([30, 35]);
  });

  it('adds manual time, and keeps no history for tracking', async () => {
    const card = await make();
    const added = await time(card.id, { op: 'add', entry: 'entry001', minutes: 75 });
    expect(valueOf(added.body.item).entries[0]!.minutes).toBe(75);
    const history = await call<ItemHistoryResponse>('GET', `/items/${card.id}/history`);
    expect(history.body.entries.map((e) => e.changes.map((c) => c.kind))).toEqual([['created']]);
  });
});

// docs/specs/013-workspace/share-roles.md: Participants track their own time; Editors everything; Viewers read.
describe('share roles', () => {
  it('lets a Participant touch only their own timer and entries', async () => {
    const card = await make();
    await time(card.id, { op: 'start', timer: 'timer001' }, PART);
    await time(card.id, { op: 'add', entry: 'entry001', minutes: 10 }, PART);
    for (const op of [
      { op: 'stop', timer: 'timer001', entry: 'entry009' },
      { op: 'remove', entry: 'timer001' },
      { op: 'remove', entry: 'entry001' },
    ]) {
      const refused = await time(card.id, op, OTHER_PART);
      expect(refused.status, op.op).toBe(403);
      expect(refused.body.error).toBe('time_not_yours');
    }
    // Their own: fine.
    expect((await time(card.id, { op: 'remove', entry: 'entry001' }, PART)).status).toBe(200);
    // Putting back someone else's entry is touching it too.
    const put = await time(
      card.id,
      {
        op: 'put',
        entry: { id: 'entry005', by: await itemPersonId('pat'), minutes: 5, at: 1 },
        person: { id: await itemPersonId('pat'), name: 'Pat', color: '#16a34a' },
      },
      OTHER_PART,
    );
    expect(put.status).toBe(403);
  });

  it('lets an Editor stop and remove anyone’s', async () => {
    const card = await make();
    await time(card.id, { op: 'start', timer: 'timer001' }, PART);
    await time(card.id, { op: 'add', entry: 'entry001', minutes: 10 }, PART);
    expect((await time(card.id, { op: 'remove', entry: 'entry001' }, EDITOR)).status).toBe(200);
    later(60_000);
    const stopped = await time(
      card.id,
      { op: 'stop', timer: 'timer001', entry: 'entry002' },
      EDITOR,
    );
    expect(stopped.status).toBe(200);
    // The entry is the timer's person's, whoever stopped it.
    expect(valueOf(stopped.body.item).entries[0]!.by).toBe(await itemPersonId('pat'));
  });

  it('refuses a Viewer and a stranger', async () => {
    const card = await make();
    expect((await time(card.id, { op: 'start', timer: 'timer001' }, VIEWER)).status).toBe(403);
    expect(
      (await time(card.id, { op: 'start', timer: 'timer001' }, { owner: 'stranger' })).status,
    ).toBe(403);
  });
});

describe('refusals', () => {
  it('refuses a bad write, a field that tracks no time, a missing card and a full field', async () => {
    const card = await make();
    expect((await time(card.id, { op: 'nope' })).body.error).toBe('time_invalid');
    expect((await time(card.id, { op: 'start', timer: 'timer001' }, {}, 'bad id!')).status).toBe(
      400,
    );
    const plain = await time(card.id, { op: 'start', timer: 'timer001' }, {}, 'f-plan');
    expect(plain.body).toEqual({ error: 'time_invalid', field: 'f-plan' });
    expect((await time('nocard01', { op: 'start', timer: 'timer001' })).status).toBe(404);
    for (let i = 0; i < 100; i += 1)
      await time(card.id, { op: 'add', entry: `entry${String(i).padStart(3, '0')}`, minutes: 1 });
    const full = await time(card.id, { op: 'add', entry: 'entry999', minutes: 1 });
    expect(full.body).toEqual({ error: 'time_full', field: FIELD });
  });

  it('refuses time written any other way, but lets a card put back carry it', async () => {
    const value = {
      people: {},
      entries: [{ id: 'entry001', by: 'someone', minutes: 5, at: 1 }],
      running: [],
    };
    const made = await call('POST', '/items', {
      type: 'task',
      fields: { title: 'T', [FIELD]: value },
    });
    expect(made.body).toEqual({ error: 'field_time_tracked', field: FIELD });
    const bulk = await call('POST', '/items/bulk', {
      items: [{ type: 'task', fields: { title: 'T', [FIELD]: value } }],
    });
    expect(bulk.body).toEqual({ error: 'field_time_tracked', field: FIELD });
    const restored = await call<{ items: Item[] }>('POST', '/items/bulk', {
      items: [{ type: 'task', key: 40, fields: { title: 'T', [FIELD]: value } }],
    });
    expect(restored.status).toBe(201);
    expect(valueOf(restored.body.items[0]!).entries).toHaveLength(1);
    const card = await make();
    // A typed value (a patch never carries a time value's object: field_value_invalid).
    const patched = await call('POST', `/items/${card.id}`, { set: { [FIELD]: 90 } });
    expect(patched.body).toEqual({ error: 'field_time_tracked', field: FIELD });
    const many = await call('POST', '/items/patches', {
      items: [{ id: card.id, set: { [FIELD]: 90 } }],
    });
    expect(many.body).toMatchObject({ error: 'field_time_tracked', id: card.id, field: FIELD });
    // A plain Duration takes whole minutes.
    expect((await call('POST', `/items/${card.id}`, { set: { 'f-plan': 90 } })).status).toBe(200);
  });
});
