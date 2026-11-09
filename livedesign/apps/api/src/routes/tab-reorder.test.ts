import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// A reorder writes only the design's own tabs, each once. It wrote a statement per entry the request named, so a
// body of ids the design lacks held the room up for each.

type Opts = Parameters<typeof makeTestRouteContext>[2];
const call = (db: SqliteD1, method: string, path: string, opts: Opts = {}) =>
  handleDesigns(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', ...opts }));

async function threeTabs(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/designs', {
    body: {
      id: 'P',
      name: 'Roadmap',
      tabs: ['t1', 't2', 't3'].map((id) => ({ id, name: id, elements: [] })),
    },
  });
  expect(res.status).toBe(201);
  return db;
}
const order = (db: SqliteD1) =>
  (
    db.sql
      .prepare("SELECT tab_id, folder FROM design_tabs WHERE design_id = 'P' ORDER BY order_index")
      .all() as { tab_id: string; folder: string | null }[]
  ).map((r) => `${r.tab_id}${r.folder ? `@${r.folder}` : ''}`);

describe('reordering tabs', () => {
  it('places the named tabs, skipping ids the design lacks, the last place an id is named winning', async () => {
    const db = await threeTabs();
    const res = await call(db, 'PUT', '/api/designs/P', {
      body: {
        name: 'Roadmap',
        tabs: ['nope', 't3', { id: 't1', folder: 'A' }, 't3', 't2', 'ghost'],
      },
    });
    expect(res.status).toBe(200);
    expect(order(db)).toEqual(['t1@A', 't3', 't2']);
  });

  it('writes no more than the design holds, however many ids a request names', async () => {
    const db = await threeTabs();
    const tabs = [...Array.from({ length: 100_000 }, () => 'nope'), 't3', 't2', 't1'];
    let status = 0;
    // The request's own work, timed in CPU.
    const ms = await cpuMsOfAsync(async () => {
      status = (await call(db, 'PUT', '/api/designs/P', { body: { name: 'Roadmap', tabs } }))
        .status;
    });
    expect(status).toBe(200);
    expect(order(db)).toEqual(['t3', 't2', 't1']);
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
