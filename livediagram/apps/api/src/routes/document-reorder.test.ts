import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The document PUT's tab order (docs/specs/006-document/tab-folders.md): `tabs` entries are a tab id, or an id with
// its folder; legacy `tabIds` are ids. Anything else is refused before the document is touched: a null entry threw
// reading its folder and an entry with no id bound undefined into the batch, both answering 500 after the rename had
// already been written.

function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  return handleDocuments(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', body }));
}

async function board(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', elements: [] },
    ],
  });
  expect(res.status).toBe(201);
  return db;
}

const order = (db: SqliteD1) =>
  db.sql
    .prepare(
      "SELECT tab_id, folder FROM document_tabs WHERE document_id = 'D' ORDER BY order_index",
    )
    .all()
    .map((r) => [r.tab_id, r.folder]);
const name = (db: SqliteD1) =>
  db.sql.prepare("SELECT name FROM document WHERE id = 'D'").get()!.name;

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('the document PUT tab order', () => {
  it('reorders, with folders, from either shape', async () => {
    const db = await board();
    expect(
      (await call(db, 'PUT', '/api/documents/D', { tabs: ['b', { id: 'a', folder: ' Q3 ' }] }))
        .status,
    ).toBe(200);
    expect(order(db)).toEqual([
      ['b', null],
      ['a', 'Q3'],
    ]);
    expect((await call(db, 'PUT', '/api/documents/D', { tabIds: ['a', 'b'] })).status).toBe(200);
    expect(order(db)).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });

  it.each([
    ['a null entry', { tabs: [null] }],
    ['an entry with no id', { tabs: [{}] }],
    ['an id that is not text', { tabs: [{ id: 5 }] }],
    ['a folder that is not text', { tabs: [{ id: 'a', folder: 5 }] }],
    ['a number', { tabs: [7] }],
    ['a legacy id that is not text', { tabIds: [null] }],
  ])('refuses %s, leaving the document as it was', async (_label, body) => {
    const db = await board();
    const res = await call(db, 'PUT', '/api/documents/D', { name: 'Renamed', ...body });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid tabs' });
    expect(name(db)).toBe('Board');
    expect(order(db)).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });
});
