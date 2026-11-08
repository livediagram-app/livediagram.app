import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A stroke is a retired element since part 4 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine"): it keeps every field it stored. A stroke in the former `{ nx, ny }` shape, from a browser
// loaded before a deploy, an API-token script or a Google Drive copy, is stored as it came, never refused and no
// longer packed.

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
  return handleDocuments(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', body }));
}

function storedElements(sql: DatabaseSync, tabId: string): Record<string, unknown>[] {
  const row = sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId);
  return (JSON.parse(row!.data as string) as { elements: Record<string, unknown>[] }).elements;
}

function expectAsStored(el: Record<string, unknown>) {
  expect(el).toEqual(legacyStroke);
}

afterEach(() => vi.restoreAllMocks());

describe('a stored stroke on the way in', () => {
  it('keeps a former-shape stroke as stored in a created document', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', {
      id: 'D',
      name: 'Board',
      tabs: [{ id: 't1', name: 'Board', elements: [legacyStroke] }],
    });
    expect(res.status).toBe(201);
    expectAsStored(storedElements(db.sql, 't1')[0]!);
  });

  it('keeps a former-shape stroke as stored in a saved tab', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [legacyStroke],
    });
    expect(res.status).toBe(200);
    expectAsStored(storedElements(db.sql, 't1')[0]!);
  });

  it('keeps a stroke whose packed points do not read, as stored: nothing draws them now', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const { points: _points, pressures: _pressures, ...rest } = legacyStroke;
    const unreadable = { ...rest, packedPoints: 'AQ*=' };
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [unreadable],
    });
    expect(res.status).toBe(200);
    expect(storedElements(db.sql, 't1')[0]).toEqual(unreadable);
  });

  it('refuses a body that is not a tab without throwing', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const withNull = { id: 't1', name: 'B', elements: [legacyStroke, null] };
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', withNull)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', null)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', 'tab')).status).toBe(400);
    const created = await call(db, 'POST', '/api/documents', { id: 'E', name: 'B', tabs: [null] });
    expect(created.status).toBe(400);
  });
});
