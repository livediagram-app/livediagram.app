import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { NAME_MAX_LENGTH } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The name cap is enforced by the worker (docs/specs/006-document/name-length.md,
// "The server is the enforcement point"): every diagram and tab name it stores
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
  return sql.prepare('SELECT name FROM documents WHERE id = ?').get(id)?.name as string | undefined;
}

function tabName(sql: DatabaseSync, id: string): string | undefined {
  return sql.prepare('SELECT name FROM tabs WHERE id = ?').get(id)?.name as string | undefined;
}

// A diagram row stored before the cap existed, holding an over-long name.
function legacyDocument(sql: DatabaseSync, id: string, name: string) {
  sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    )
    .run(id, 'owner', name, T0, T0);
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/documents name cap', () => {
  it('stores and returns an over-long diagram name shortened', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', { id: 'D', name: LONG });
    expect(res.status).toBe(201);
    expect(documentName(db.sql, 'D')).toBe(LONG_CAPPED);
    expect(((await res.json()) as { document: { name: string } }).document.name).toBe(LONG_CAPPED);
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
    expect(((await res.json()) as { tab: { name: string } }).tab.name).toBe(LONG_CAPPED);
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

describe('POST /api/documents/:id/copy name cap', () => {
  it('shortens a default "Copy of" name that runs past the cap', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', {
      id: 'D',
      name: 'Quarterly platform migration plan for payments',
    });
    const res = await call(db, 'POST', '/api/documents/D/copy', {});
    expect(res.status).toBe(201);
    const { document: liveDoc } = (await res.json()) as { document: { id: string; name: string } };
    expect(liveDoc.name).toBe('Copy of Quarterly platform migration plan for payments');
    const res2 = await call(db, 'POST', '/api/documents/D/copy', { name: LONG });
    const copy = (await res2.json()) as { document: { id: string; name: string } };
    expect(copy.document.name).toBe(LONG_CAPPED);
    expect(documentName(db.sql, copy.document.id)).toBe(LONG_CAPPED);
  });

  it('shortens the default name built from a source already at the cap', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/documents', { id: 'D', name: LONG_CAPPED });
    const res = await call(db, 'POST', '/api/documents/D/copy', {});
    const { document: liveDoc } = (await res.json()) as { document: { name: string } };
    expect([...liveDoc.name].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(liveDoc.name.startsWith('Copy of Quarterly')).toBe(true);
  });
});
