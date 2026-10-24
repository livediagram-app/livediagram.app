import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// Every tab the api receives is validated (docs/specs/015-api/api.md "The persistence boundary"): a stroke whose
// points are malformed, or a body that is not a tab, is refused rather than stored.

const legacyStroke = {
  id: 'f1',
  type: 'freehand',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  closed: false,
  penWidth: 1.5,
  points: [
    { nx: 0, ny: 0 },
    { nx: 0.5, ny: 1 },
    { nx: 1, ny: 0.25 },
  ],
  pressures: [0.25, 0.5, 0.75],
};

function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  return handleProjects(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', body }));
}

afterEach(() => vi.restoreAllMocks());

describe('stroke points on the way in', () => {
  it('still refuses a stroke that is neither shape', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/projects', { id: 'D', name: 'Board' });
    const res = await call(db, 'PUT', '/api/projects/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [
        { ...legacyStroke, points: undefined, pressures: undefined, packedPoints: 'AQ*=' },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('refuses a body that is not a tab without throwing', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/projects', { id: 'D', name: 'Board' });
    const withNull = { id: 't1', name: 'B', elements: [legacyStroke, null] };
    expect((await call(db, 'PUT', '/api/projects/D/tabs/t1', withNull)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/projects/D/tabs/t1', null)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/projects/D/tabs/t1', 'tab')).status).toBe(400);
    const created = await call(db, 'POST', '/api/projects', { id: 'E', name: 'B', tabs: [null] });
    expect(created.status).toBe(400);
  });
});
