import { describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';

// The index as the delete calls it: no share links to revoke.
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({ listShareLinks: async () => ({ links: [], passwordSet: false }) }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// A token may not delete a design's last tab (docs/specs/015-api/mcp-server.md). The count was read before the
// gates' awaits, so two token deletes sent at once each saw two tabs and together left the design with none.

type Opts = Parameters<typeof makeTestRouteContext>[2];
const call = (db: SqliteD1, method: string, path: string, opts: Opts = {}) =>
  handleDesigns(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', ...opts }));

async function twoTabs(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/designs', {
    body: {
      id: 'P',
      name: 'Roadmap',
      tabs: [
        { id: 't1', name: 'One', elements: [] },
        { id: 't2', name: 'Two', elements: [] },
      ],
    },
  });
  expect(res.status).toBe(201);
  return db;
}
const tabsLeft = (db: SqliteD1) =>
  (
    db.sql.prepare("SELECT COUNT(*) AS n FROM design_tabs WHERE design_id = 'P'").get() as {
      n: number;
    }
  ).n;

describe('two token deletes at once', () => {
  it('keep the last tab: one deletes, the other is refused', async () => {
    const db = await twoTabs();
    const token = { token: { id: 'tok' } };
    const [a, b] = await Promise.all([
      call(db, 'DELETE', '/api/designs/P/tabs/t1', token),
      call(db, 'DELETE', '/api/designs/P/tabs/t2', token),
    ]);
    expect([a.status, b.status].sort()).toEqual([204, 409]);
    expect(tabsLeft(db)).toBe(1);
    // The refused tab keeps its body.
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM tabs').get()).toEqual({ n: 1 });
  });

  it('answer a tab another delete took first as gone, not as the last tab', async () => {
    const db = await twoTabs();
    const token = { token: { id: 'tok' } };
    const [a, b] = await Promise.all([
      call(db, 'DELETE', '/api/designs/P/tabs/t1', token),
      call(db, 'DELETE', '/api/designs/P/tabs/t1', token),
    ]);
    expect([a.status, b.status]).toEqual([204, 204]);
    expect(tabsLeft(db)).toBe(1);
  });
});
