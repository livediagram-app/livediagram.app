import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { FlowResponse, ItemResponse } from '@liveplanner/api-schema';
import {
  DAY_MS,
  FLOW_DAYS_MAX,
  ITEM_TYPES_MAX,
  cycleTimesOf,
  flowCountsOf,
  presetSetup,
  throughputOf,
  type Item,
  type StatusPhase,
} from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { flowQueryOf, handleFlowRoute } from './flow-route';

// The flow charts' read (docs/specs/026-plan/plan-views.md "Flow charts", blueprint item-store.md "Flow read"): the
// range's daily counts and each card that moved in it with its kept moves; the card types asked for; who may read it
// (Editor, Participant, Viewer, an agent, a tab-scoped link); the query's refusals; and a 2,000-card plan's budget.

let sql: SqliteD1;

type Who = { owner?: string | null; code?: string; agent?: boolean };

async function call<T = unknown>(method: string, path: string, body?: unknown, who: Who = {}) {
  const ctx = makeTestRouteContext(method, `/api/projects/p1${path}`, {
    env: sql.env,
    owner: who.owner === undefined ? 'owner' : who.owner,
    ...(who.code ? { headers: { 'X-Share-Code': who.code } } : {}),
    ...(who.agent ? { token: { id: 'tok-1' } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: () => undefined,
  });
  const res = await handleProjects(ctx);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const flow = (query = '', who: Who = {}) =>
  call<FlowResponse & { error?: string }>('GET', `/flow${query}`, undefined, who);

const make = async (fields: Item['fields'], type = 'task') =>
  (await call<ItemResponse>('POST', '/items', { type, fields })).body.item;
const move = (id: string, status: string) => call('POST', `/items/${id}/move`, { status });

// The flow counts are kept on SQLite's own clock (today, for real), so the faked clock stands at the real now and
// steps back for the history it writes.
const NOW = Date.now();
const atDaysAgo = (days: number, hours = 0) =>
  vi.setSystemTime(NOW - days * DAY_MS + hours * 3_600_000);

const phases = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['done', 'done'],
]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('visitor', 'Vee', '#16a34a');
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
  testShareLink(sql, 'p1', 'TAB1', 'edit', 'never', 't1');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what it answers', () => {
  let shipped: Item;
  let stalled: Item;
  let fresh: Item;
  beforeEach(async () => {
    atDaysAgo(40);
    stalled = await make({ title: 'Stalled', status: 'todo' });
    await move(stalled.id, 'doing');
    atDaysAgo(20);
    shipped = await make({ title: 'Shipped', status: 'todo' });
    atDaysAgo(20, 1);
    await move(shipped.id, 'doing');
    atDaysAgo(2);
    await call('POST', `/items/${shipped.id}`, { set: { priority: 'high' } });
    await move(shipped.id, 'done');
    vi.setSystemTime(NOW);
    fresh = await make({ title: 'Fresh', status: 'todo' });
  });

  it('answers the range’s counts, and each card that moved in it with its moves back past the range', async () => {
    const res = await flow('?days=14');
    expect(res.status).toBe(200);
    const today = Math.floor(NOW / DAY_MS);
    expect(res.body).toMatchObject({ fromDay: today - 13, toDay: today });
    expect(res.body.cards).toEqual([
      {
        id: shipped.id,
        type: 'task',
        createdAt: NOW - 20 * DAY_MS,
        since: NOW - 20 * DAY_MS,
        moves: [
          [NOW - 20 * DAY_MS + 3_600_000, 'todo', 'doing'],
          [NOW - 2 * DAY_MS, 'doing', 'done'],
        ],
      },
    ]);
    // Today's counts, every card standing where it is (the flow counts keep the day on SQLite's clock).
    const counts = flowCountsOf(res.body.counts, res.body.fromDay, res.body.toDay);
    expect(counts.byStatus.get('done')?.at(-1)).toBe(1);
    expect(counts.byStatus.get('doing')?.at(-1)).toBe(1);
    expect(counts.byStatus.get('todo')?.at(-1)).toBe(1);
    // What the charts work out of it.
    const cycle = cycleTimesOf(res.body.cards, phases, res.body.fromDay, today);
    expect(cycle.cards.map((c) => [c.itemId, c.days])).toEqual([[shipped.id, 18]]);
    expect(cycle.p85).toBe(18);
    const weekly = throughputOf(cycle.cards, res.body.fromDay, today, 'day');
    expect(weekly.periods.reduce((n, p) => n + p.cards, 0)).toBe(1);
    expect(res.body.cards.some((c) => c.id === fresh.id)).toBe(false);
  });

  it('reads 30 days when no range is given, and a longer range reaches older moves', async () => {
    const plain = await flow();
    expect(plain.body.toDay - plain.body.fromDay + 1).toBe(30);
    expect(plain.body.cards.map((c) => c.id)).toEqual([shipped.id]);
    const longer = await flow(`?days=${FLOW_DAYS_MAX}`);
    expect(longer.body.cards.map((c) => c.id).sort()).toEqual([shipped.id, stalled.id].sort());
  });

  it('names no author, tag or value: statuses and times only', async () => {
    const text = JSON.stringify((await flow('?days=90')).body);
    expect(text).not.toMatch(/Webber|owner|high|priority|"by"|"tag"/);
  });

  it('answers only the card types asked for, every type for an empty list', async () => {
    const bug = await make({ title: 'Crash', status: 'todo' }, 'bug');
    await move(bug.id, 'doing');
    const bugs = await flow('?types=bug');
    expect(bugs.body.cards.map((c) => c.id)).toEqual([bug.id]);
    expect(bugs.body.counts.length).toBeGreaterThan(0);
    expect(bugs.body.counts.every((r) => r.type === 'bug')).toBe(true);
    const every = await flow('?types=,%20,');
    expect(every.body.cards.map((c) => c.id).sort()).toEqual([shipped.id, bug.id].sort());
  });
});

describe('the query', () => {
  const q = (s: string) => flowQueryOf(new URLSearchParams(s));

  it('reads the range and the types', () => {
    expect(q('')).toEqual({ days: 30, types: null });
    expect(q('days=1&types=bug,%20task')).toEqual({ days: 1, types: new Set(['bug', 'task']) });
    expect(q('days=180')).toMatchObject({ days: 180 });
  });

  it('refuses a range past the kept days, or one that is not a whole number', async () => {
    for (const days of ['0', '181', '', 'abc', '1e2', '-5', '30.5', '0030', ' 30']) {
      const res = await flow(`?days=${encodeURIComponent(days)}`);
      expect([days, res.status, res.body.error]).toEqual([days, 400, 'flow_range']);
    }
  });

  it('refuses more card types than a catalogue holds', async () => {
    const many = Array.from({ length: ITEM_TYPES_MAX + 1 }, (_, i) => `t${i}`).join(',');
    expect((await flow(`?types=${many}`)).body).toEqual({ error: 'flow_types' });
    const most = Array.from({ length: ITEM_TYPES_MAX }, (_, i) => `t${i}`).join(',');
    expect((await flow(`?types=${most}`)).status).toBe(200);
  });

  it('reads a very long range or types value in linear time', () => {
    expect(q(`days=${'9'.repeat(50_000)}`)).toBeInstanceOf(Response);
    expect(q(`types=${','.repeat(50_000)}`)).toEqual({ days: 30, types: null });
  });
});

describe('who may read it', () => {
  it('answers an Editor, a Participant, a Viewer and an agent alike', async () => {
    const card = await make({ title: 'Moved', status: 'todo' });
    await move(card.id, 'doing');
    for (const who of [
      {},
      { owner: 'visitor', code: 'PART' },
      { owner: 'visitor', code: 'LOOK' },
      { agent: true },
    ]) {
      const res = await flow('', who);
      expect(res.status).toBe(200);
      expect(res.body.cards.map((c) => c.id)).toEqual([card.id]);
    }
  });

  it('answers a tab-scoped link on a tab that shows every card, and refuses one that shows only some', async () => {
    const card = await make({ title: 'Moved', status: 'todo' });
    const who = { owner: 'visitor', code: 'TAB1' };
    expect((await flow('?tabId=t1', who)).status).toBe(200);
    expect((await flow('', who)).status).toBeGreaterThanOrEqual(403);
    sql.sql.prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'`).run(
      JSON.stringify({
        elements: [
          {
            id: 'c1',
            type: 'shape',
            shape: 'plan-card',
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            planCard: { itemId: card.id },
          },
        ],
      }),
    );
    expect((await flow('?tabId=t1', who)).body).toEqual({ error: 'flow_needs_every_card' });
  });

  it('refuses someone with no access, and a plan that does not exist', async () => {
    expect((await flow('', { owner: 'stranger' })).status).toBeGreaterThanOrEqual(403);
    const ctx = makeTestRouteContext('GET', '/api/projects/nope/flow', {
      env: sql.env,
      owner: 'owner',
    });
    expect((await handleProjects(ctx)).status).toBe(404);
  });

  it('is read only', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await call(method, '/flow', {})).status).toBe(405);
      const ctx = makeTestRouteContext(method, '/api/projects/p1/flow', {
        env: sql.env,
        owner: 'owner',
      });
      expect((await handleFlowRoute(ctx))?.status).toBe(405);
    }
    const other = makeTestRouteContext('GET', '/api/projects/p1/flow/more', {
      env: sql.env,
      owner: 'owner',
    });
    expect(await handleFlowRoute(other)).toBeNull();
  });
});

describe('a 2,000-card plan with 180 days of history', () => {
  it('answers the longest range within budget', async () => {
    const statuses = ['todo', 'doing', 'review', 'done'];
    const now = Date.now();
    const today = Math.floor(now / DAY_MS);
    sql.sql.exec('BEGIN');
    const item = sql.sql.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('p1', ?, ?, ?, 'i', ?, 1, ?, ?, '{}', '{}')`,
    );
    const entry = sql.sql.prepare(
      `INSERT INTO item_history (plan_id, item_id, at, by, tag, changes) VALUES ('p1', ?, ?, '{"name":"W"}', NULL, ?)`,
    );
    const made = now - 179 * DAY_MS;
    const entries: [string, number, string][] = [];
    for (let c = 0; c < 2000; c++) {
      const id = `card${c}`;
      item.run(
        id,
        c % 3 === 0 ? 'bug' : 'task',
        c + 1,
        JSON.stringify({ title: id, status: 'done' }),
        made,
        now,
      );
      entries.push([id, made + c, JSON.stringify([{ kind: 'created' }])]);
      // Twelve moves and twelve field changes over 180 days, so 50,000 entries, half of them moves.
      for (let m = 0; m < 12; m++) {
        const when = made + m * 14 * DAY_MS + c * 1000;
        entries.push([
          id,
          when,
          JSON.stringify([{ kind: 'moved', from: statuses[m % 4], to: statuses[(m + 1) % 4] }]),
        ]);
        entries.push([
          id,
          when + 60_000,
          JSON.stringify([{ kind: 'set', field: 'priority', to: 'high' }]),
        ]);
      }
    }
    entries.sort((a, b) => a[1] - b[1]);
    for (const [id, at, changes] of entries) entry.run(id, at, changes);
    // A dozen type and status pairs on each of the 181 kept days.
    const count = sql.sql.prepare(
      `INSERT OR REPLACE INTO flow_counts (plan_id, day, type, status, cards) VALUES ('p1', ?, ?, ?, ?)`,
    );
    for (let d = today - FLOW_DAYS_MAX; d <= today; d++)
      for (const type of ['task', 'bug', 'story'])
        for (const status of statuses) count.run(d, type, status, 100);
    sql.sql.exec('COMMIT');
    let res: Awaited<ReturnType<typeof flow>> | undefined;
    const ms = await cpuMsOfAsync(async () => {
      res = await flow(`?days=${FLOW_DAYS_MAX}`);
    });
    expect(res!.status).toBe(200);
    expect(res!.body.cards).toHaveLength(2000);
    expect(res!.body.cards.reduce((n, c) => n + c.moves.length, 0)).toBe(24_000);
    expect(res!.body.counts.length).toBe(FLOW_DAYS_MAX * 12);
    // Measured 135 to 150 ms of CPU on node:sqlite (2026-11-15), its answer 1.06 MB, 94 KB gzipped.
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});
