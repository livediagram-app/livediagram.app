import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentSummary } from '@livepages/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyDocument, getDocument, listDocumentsByOwner } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './placement-test-support';

// The recorded creation intent against a real schema (docs/specs/013-workspace/default-folders.md
// "Recorded intent"): written by the create insert, never rewritten, read back on the summary, null
// (unknown) without an intent, carried by a copy.

let db: SqliteD1;

const UNKNOWN = { opensIn: null, tabKind: null };
const PAGES = { opensIn: 'pages', tabKind: 'diagram' };

function create(id: string, extra: Record<string, unknown> = {}) {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...asUser('user_alice'),
      body: { id, name: 'Doc', tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }], ...extra },
    }),
  );
}

const stored = (id: string) =>
  db.sql.prepare('SELECT opens_in, tab_kind FROM documents WHERE id = ?').get(id);

async function summary(id: string): Promise<DocumentSummary | undefined> {
  return (await listDocumentsByOwner(db.env, 'user_alice')).find((d) => d.id === id);
}

beforeEach(() => {
  db = sqliteD1();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recorded creation intent', () => {
  it('records opens-in and tab kind in the create insert', async () => {
    await create('d1', { intent: { mode: 'pages' } });
    expect({ ...stored('d1') }).toEqual({ opens_in: 'pages', tab_kind: 'diagram' });
    expect(await summary('d1')).toMatchObject(PAGES);
  });

  it('records a livediagram mode as Pages', async () => {
    await create('d1', { intent: { mode: 'draw' } });
    expect(await summary('d1')).toMatchObject(PAGES);
  });

  it('records nothing for a create without an intent', async () => {
    await create('d1');
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });

  it('records the intent of a create filed at an explicit root', async () => {
    await create('d1', { folderId: null, intent: { mode: 'pages' } });
    expect(await summary('d1')).toMatchObject({ opensIn: 'pages', folderId: null });
  });

  it('never rewrites the record on a re-commit', async () => {
    await create('d1');
    await create('d1', { intent: { mode: 'pages' } });
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });

  it('exposes the record on the document as well as the summary', async () => {
    await create('d1', { intent: { mode: 'pages' } });
    expect(await getDocument(db.env, 'd1')).toMatchObject(PAGES);
  });

  it('reads a row with no intent recorded as unknown', async () => {
    db.sql
      .prepare(
        `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
         VALUES ('old', 'user_alice', 'Old', 0, 1, 1)`,
      )
      .run();
    expect(await summary('old')).toMatchObject(UNKNOWN);
  });

  it('reads a stored value outside the enums as unknown', async () => {
    await create('d1', { intent: { mode: 'pages' } });
    db.sql.prepare("UPDATE documents SET opens_in = 'retired' WHERE id = 'd1'").run();
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });

  it("carries the source's record into a copy", async () => {
    await create('d1', { intent: { mode: 'pages' } });
    await copyDocument(db.env, 'd1', 'd2', 'user_alice', 'Copy');
    expect({ ...stored('d2') }).toEqual({ opens_in: 'pages', tab_kind: 'diagram' });
  });
});
