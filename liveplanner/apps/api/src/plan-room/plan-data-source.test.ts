// A plan's cards as live data (liveworkspace/docs/specs/004-index/live-data.md; docs/specs/015-api/api.md "Live data"):
// the door on the index's key alone, the plan's boards, metrics and filter values, a board's cards counted by each of
// column, label, assignee and priority with its filters, a metric's rows, nothing of a card beyond the count, and the
// cards watch for the item that asked.
import { describe, expect, it } from 'vitest';
import { defaultCatalogue, typesOf, type Item } from '@liveplanner/items';
import type { Element, Tab } from '@liveplanner/project';
import { insertItems } from '../db/items';
import { upsertTab } from '../db/tabs';
import { handleInternalItems } from '../routes/internal-items';
import { sqliteD1 } from '../test-sqlite-d1';
import { setPlanItemTypes } from './plan-content';
import { boardCounts, metricTable, PLAN_DATA_CATEGORIES_MAX } from './plan-data-source';

const ADA = { id: 'user_ada', name: 'Ada', color: '#123456' };
const BO = { id: 'user_bo', name: 'Bo', color: '#654321' };

const board: Element = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  planBoard: {
    title: 'Roadmap',
    columns: [
      { id: 'col1', name: 'To Do', status: 'todo' },
      { id: 'col2', name: 'Doing', status: 'doing' },
      { id: 'col3', name: 'Done', status: 'done' },
    ],
  },
} as Element;

const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields: { title: `Secret title ${id}`, ...fields },
  rev: 1,
  createdAt: 10,
  updatedAt: 20,
  createdBy: ADA,
  updatedBy: ADA,
});

async function arrange() {
  const db = sqliteD1({ INDEX_KEY: 'index-key', DATA_EXPORT_KEY: 'export-key' });
  const send = (path: string, body?: unknown, key = 'index-key') =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      db.env,
    );
  db.sql.exec(
    `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at) VALUES ('A', 'user_ada', 'Plan', 0, 1, 1)`,
  );
  await setPlanItemTypes(db.env, 'A', defaultCatalogue());
  const tab = (t: Partial<Tab> & { id: string; name: string }, order: number) =>
    upsertTab(db.env, 'A', { elements: [], ...t }, order);
  await tab({ id: 't1', name: 'Roadmap', kind: 'board', elements: [board] }, 0);
  await tab({ id: 't2', name: 'Notes', kind: 'diagram', elements: [] }, 1);
  await insertItems(db.env, 'A', [
    card('c1', 1, { status: 'todo', priority: 'high', labels: ['bug'], assignee: ADA }),
    card('c2', 2, { status: 'todo', priority: 'low', labels: ['bug', 'ui'] }),
    card('c3', 3, { status: 'doing', priority: 'high', labels: ['ui'], assignee: BO }),
    card('c4', 4, { status: 'done', assignee: ADA }),
    card('c5', 5, { status: 'trash', trashedFrom: 'done' }),
  ]);
  return { db, send };
}

const ask = (by: string, filter?: Record<string, string>) => ({
  kind: 'board',
  boardId: 't1',
  by,
  ...(filter ? { filter } : {}),
});

describe('the plan-data door', () => {
  it("lists the plan's boards, every metric and the values a filter names", async () => {
    const { send } = await arrange();
    const res = await send('A/plan-data');
    expect(res.status).toBe(200);
    const listing = await res.json<{
      boards: unknown[];
      metrics: { id: string; label: string }[];
      filters: { priorities: unknown[]; labels: string[]; people: unknown[]; types: unknown[] };
    }>();
    expect(listing.boards).toEqual([{ id: 't1', name: 'Roadmap', tabId: 't1' }]);
    expect(listing.metrics.map((m) => m.id)).toContain('progress');
    expect(listing.filters.labels).toEqual(['bug', 'ui']);
    expect(listing.filters.people).toEqual([
      { id: 'user_ada', name: 'Ada' },
      { id: 'user_bo', name: 'Bo' },
    ]);
    expect(listing.filters.priorities).toHaveLength(4);
    expect(listing.filters.types.length).toBeGreaterThan(0);
  });

  it('counts a board by column, label, assignee and priority', async () => {
    const { send } = await arrange();
    const read = async (by: string, filter?: Record<string, string>) =>
      (await (await send('A/plan-data', ask(by, filter))).json<{ table: unknown }>()).table;
    expect(await read('column')).toEqual({
      categories: ['To Do', 'Doing', 'Done'],
      series: [{ name: 'Cards', values: [2, 1, 1] }],
    });
    expect(await read('label')).toEqual({
      categories: ['bug', 'ui'],
      series: [{ name: 'Cards', values: [2, 2] }],
    });
    expect(await read('assignee')).toEqual({
      categories: ['Ada', 'Bo', 'Unassigned'],
      series: [{ name: 'Cards', values: [2, 1, 1] }],
    });
    expect(await read('priority')).toEqual({
      categories: ['High', 'Low', 'No Priority'],
      series: [{ name: 'Cards', values: [2, 1, 1] }],
    });
    expect(await read('column', { priority: 'high' })).toEqual({
      categories: ['To Do', 'Doing', 'Done'],
      series: [{ name: 'Cards', values: [1, 1, 0] }],
    });
    expect(await read('column', { label: 'ui', person: 'user_bo' })).toEqual({
      categories: ['To Do', 'Doing', 'Done'],
      series: [{ name: 'Cards', values: [0, 1, 0] }],
    });
  });

  it("answers the board's name and the words for what was read, and nothing of a card", async () => {
    const { send } = await arrange();
    const res = await send('A/plan-data', ask('column'));
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({
      sourceName: 'Roadmap',
      tabId: 't1',
      label: 'Cards per column',
    });
    expect(text).not.toContain('Secret title');
  });

  it("reads a metric's rows across the plan", async () => {
    const { send } = await arrange();
    const res = await send('A/plan-data', { kind: 'metric', metric: 'priorities' });
    expect(await res.json()).toMatchObject({
      sourceName: 'Dashboard',
      tabId: '',
      table: { categories: ['High', 'Low'], series: [{ values: [2, 1] }] },
    });
    const count = await (await send('A/plan-data', { kind: 'metric', metric: 'count' })).json<{
      table: { series: { values: number[] }[] };
    }>();
    expect(count.table.series[0]!.values.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('answers a missing board, metric or plan, a malformed ask and another key', async () => {
    const { send } = await arrange();
    expect((await send('A/plan-data', { ...ask('column'), boardId: 't2' })).status).toBe(404);
    expect((await send('A/plan-data', { ...ask('column'), boardId: 't9' })).status).toBe(404);
    expect((await send('A/plan-data', { kind: 'metric', metric: 'nope' })).status).toBe(404);
    expect((await send('B/plan-data', ask('column'))).status).toBe(404);
    expect((await send('B/plan-data')).status).toBe(404);
    expect((await send('A/plan-data', { kind: 'board' })).status).toBe(400);
    expect((await send('A/plan-data', ask('column'), 'export-key')).status).toBe(401);
  });

  it("keeps a watch on the plan's cards for the item that asked, and none without one", async () => {
    const { db, send } = await arrange();
    await send('A/plan-data', ask('column'));
    await send('A/plan-data', { ...ask('label'), watcher: 'doc1' });
    await send('A/plan-data', { kind: 'metric', metric: 'count', watcher: 'doc2' });
    const watches = await db.env.PLAN_DB.prepare(
      'SELECT watcher, sheet_id, plan_id FROM sheet_watches ORDER BY watcher',
    ).all();
    expect(watches.results).toEqual([
      { watcher: 'doc1', sheet_id: 'cards', plan_id: 'A' },
      { watcher: 'doc2', sheet_id: 'cards', plan_id: 'A' },
    ]);
  });
});

describe('the counts', () => {
  it('keeps the largest of a long count, within the chart cap', () => {
    const items = new Map<string, Item>();
    for (let i = 0; i < PLAN_DATA_CATEGORIES_MAX + 20; i++)
      items.set(`c${i}`, card(`c${i}`, i, { status: 'todo', labels: [`l${i}`, 'common'] }));
    const setup = {
      title: 'B',
      columns: [{ id: 'col1', name: 'To Do', status: 'todo' }],
      swimlaneBy: 'none',
      cardFields: [],
      hideWriting: false,
    } as never;
    const table = boardCounts(
      setup,
      { items, types: typesOf(defaultCatalogue()), statusNames: new Map(), isDone: () => false },
      'label',
    );
    expect(table.categories).toHaveLength(PLAN_DATA_CATEGORIES_MAX);
    expect(table.categories[0]).toBe('common');
  });

  it("draws a ring as Done and Not Done, and a lone figure as one row", () => {
    expect(metricTable({ hero: '40', line: '', visual: { kind: 'ring', pct: 40 } }, 'Done')).toEqual({
      categories: ['Done', 'Not Done'],
      series: [{ name: 'Done', values: [40, 60] }],
    });
    expect(metricTable({ hero: '7', line: '', visual: null }, 'Stale')).toEqual({
      categories: ['Stale'],
      series: [{ name: 'Stale', values: [7] }],
    });
    expect(metricTable({ hero: '–', line: '', visual: null }, 'Completion').series[0]!.values).toEqual(
      [0],
    );
    expect(
      metricTable(
        {
          hero: '2',
          line: '',
          visual: { kind: 'people', rows: [{ person: ADA, count: 2 }] },
        },
        'People',
      ).categories,
    ).toEqual(['Ada']);
  });
});
