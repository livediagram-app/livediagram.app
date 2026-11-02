import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { NAME_MAX_LENGTH } from '@livehuddle/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';

// The titles the index was asked to give a copy.
const { copies } = vi.hoisted(() => ({ copies: [] as { id: string; title?: string }[] }));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    copyItem: async (id: string, input: { title?: string } = {}) => {
      copies.push({ id, ...input });
      return {
        item: {
          id: `${id}-copy`,
          ownerId: 'owner',
          teamId: null,
          folderId: null,
          title: input.title ?? 'Copy of …',
          source: null,
          intent: null,
          summary: {},
          sharedVia: null,
          createdAt: 1,
          updatedAt: 1,
        },
      };
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleDocumentIndexRoutes } from './document-index-routes';

// The name cap is enforced by the worker (docs/specs/006-document/name-length.md,
// "The server is the enforcement point"): every document and tab name it stores
// is shortened to NAME_MAX_LENGTH, whoever sent it, and a name echoed back
// unchanged is never rewritten.

const T0 = 1_700_000_000_000;
const LONG = 'Quarterly platform migration plan for the payments team and friends';
const LONG_CAPPED = 'Quarterly platform migration plan for the payments team…';

const square = { id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 };

function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  return handleDocuments(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', body }));
}

function documentName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM document WHERE id = ?').get(id)?.name as string | undefined;
}

function tabName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM tabs WHERE id = ?').get(id)?.name as string | undefined;
}

// A document row stored before the cap existed, holding an over-long name.
function legacyDocument(sql: DatabaseSync, id: string, name: string) {
  sql
    .prepare(
      'INSERT INTO test_documents (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, 'owner', name, T0, T0);
}

beforeEach(() => {
  copies.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/documents name cap', () => {
  it('stores and returns an over-long document name shortened', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', { id: 'D', name: LONG });
    expect(res.status).toBe(201);
    expect(documentName(db.sql, 'D')).toBe(LONG_CAPPED);
    expect((await res.json<{ document: { name: string } }>()).document.name).toBe(LONG_CAPPED);
  });

  it('shortens every seeded tab name', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', {
      id: 'D',
      name: 'Plan',
      tabs: [{ id: 't1', name: LONG, elements: [square] }],
    });
    expect(tabName(db.sql, 't1')).toBe(LONG_CAPPED);
  });

  it('accepts a name far past the old 500-character bound, shortened', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', { id: 'D', name: 'word '.repeat(200) });
    expect(res.status).toBe(201);
    expect([...documentName(db.sql, 'D')!].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('refuses a name that is only whitespace', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', { id: 'D', name: ' \n\t ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'missing id/name' });
    expect(documentName(db.sql, 'D')).toBeUndefined();
  });
});

describe('PUT /api/documents/:id name cap', () => {
  it('shortens a rename', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Plan' });
    const res = await call(db, 'PUT', '/api/documents/D', { name: LONG });
    expect(res.status).toBe(200);
    expect(documentName(db.sql, 'D')).toBe(LONG_CAPPED);
  });

  it('leaves a pre-cap over-long name alone when it is sent back unchanged', async () => {
    const db = sqliteD1();
    legacyDocument(db.sql, 'D', LONG);
    const res = await call(db, 'PUT', '/api/documents/D', { name: LONG, tabIds: [] });
    expect(res.status).toBe(200);
    expect(documentName(db.sql, 'D')).toBe(LONG);
  });

  it('refuses a rename to only whitespace, keeping the name', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Plan' });
    const res = await call(db, 'PUT', '/api/documents/D', { name: '   ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'missing name' });
    expect(documentName(db.sql, 'D')).toBe('Plan');
  });
});

describe('PUT /api/documents/:id/tabs/:tabId name cap', () => {
  it('shortens a new tab name', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Plan' });
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: LONG,
      elements: [square],
    });
    expect(res.status).toBe(200);
    expect(tabName(db.sql, 't1')).toBe(LONG_CAPPED);
    expect((await res.json<{ tab: { name: string } }>()).tab.name).toBe(LONG_CAPPED);
  });

  it('leaves a pre-cap over-long tab name alone on an unchanged autosave', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Plan' });
    await call(db, 'PUT', '/api/documents/D/tabs/t1', { id: 't1', name: 'Tab', elements: [] });
    db.sql.prepare('UPDATE tabs SET name = ? WHERE id = ?').run(LONG, 't1');
    await call(db, 'PUT', '/api/documents/D/tabs/t1', { id: 't1', name: LONG, elements: [square] });
    expect(tabName(db.sql, 't1')).toBe(LONG);
  });

  it('keeps an empty tab name empty', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: 'Plan' });
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      id: 't1',
      name: '',
      elements: [],
    });
    expect(res.status).toBe(200);
    expect(tabName(db.sql, 't1')).toBe('');
  });
});

// A copy is the index's to make (it names one asked for no name "Copy of …"); a name asked for is capped here first.
describe('POST /api/documents/:id/copy name cap', () => {
  it('shortens a name asked for before the index makes the copy', async () => {
    const db = sqliteD1();
    const res = (await handleDocumentIndexRoutes(
      makeTestRouteContext('POST', '/api/documents/D/copy', {
        env: db.env,
        owner: 'owner',
        body: { name: LONG },
      }),
    ))!;
    expect(res.status).toBe(201);
    expect(copies).toEqual([{ id: 'D', title: LONG_CAPPED }]);
    expect((await res.json<{ document: { name: string } }>()).document.name).toBe(LONG_CAPPED);
  });
});
