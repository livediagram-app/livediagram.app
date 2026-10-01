import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { parseStrokePoints } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Every tab the api receives runs the stored-tab migration before validation
// (docs/specs/015-api/api.md "The persistence boundary", docs/specs/006-document/stroke-points.md
// "Migration of stored strokes"): a stroke in the former `{ nx, ny }` shape, from a browser loaded
// before a deploy, an API-token script or a Google Drive copy, is stored packed, never refused.

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

function expectPacked(el: Record<string, unknown>) {
  expect(el).not.toHaveProperty('points');
  expect(el).not.toHaveProperty('pressures');
  const parsed = parseStrokePoints(el.packedPoints);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.points.count).toBe(3);
    expect(parsed.points.pressures).not.toBeNull();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('stroke points on the way in', () => {
  it('packs a former-shape stroke in a created document', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', {
      id: 'D',
      name: 'Board',
      tabs: [{ id: 't1', name: 'Board', elements: [legacyStroke] }],
    });
    expect(res.status).toBe(201);
    expectPacked(storedElements(db.sql, 't1')[0]!);
  });

  it('packs a former-shape stroke in a saved tab', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [legacyStroke],
    });
    expect(res.status).toBe(200);
    expectPacked(storedElements(db.sql, 't1')[0]!);
  });

  it('still refuses a stroke that is neither shape', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
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
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Board' });
    const withNull = { id: 't1', name: 'B', elements: [legacyStroke, null] };
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', withNull)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', null)).status).toBe(400);
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', 'tab')).status).toBe(400);
    const created = await call(db, 'POST', '/api/documents', { id: 'E', name: 'B', tabs: [null] });
    expect(created.status).toBe(400);
  });
});
