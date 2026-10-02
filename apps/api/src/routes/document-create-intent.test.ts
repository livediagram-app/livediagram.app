import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentSummary } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyDocument, listDocumentsByOwner } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { asUser } from './placement-test-support';

// The recorded creation intent against a real schema (docs/specs/013-workspace/default-folders.md
// "Recorded intent"): written by the create insert, never rewritten, read back on the summary, null
// (unknown) without an intent and on rows from before it was recorded, carried by a copy.

let db: SqliteD1;

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
  db.sql.prepare('SELECT opens_in, board_type FROM documents WHERE id = ?').get(id);

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
  it('records the mode and board type in the create insert', async () => {
    await create('d1', { intent: { mode: 'diagram', boardType: 'retrospective' } });
    expect({ ...stored('d1') }).toEqual({ opens_in: 'diagram', board_type: 'retrospective' });
    expect(await summary('d1')).toMatchObject({ opensIn: 'diagram', boardType: 'retrospective' });
  });

  it('records a known mode with no board as not a board', async () => {
    await create('d1', { intent: { mode: 'draw' } });
    expect(await summary('d1')).toMatchObject({ opensIn: 'draw', boardType: null });
  });

  it('records nothing for a create without an intent', async () => {
    await create('d1');
    expect(await summary('d1')).toMatchObject({ opensIn: null, boardType: null });
  });

  it('never rewrites the record on a re-commit', async () => {
    await create('d1', { intent: { mode: 'draw' } });
    await create('d1', { intent: { mode: 'diagram', boardType: 'kanban' } });
    expect(await summary('d1')).toMatchObject({ opensIn: 'draw', boardType: null });
  });

  it('reads a row from before intents were recorded as unknown', async () => {
    db.sql
      .prepare(
        `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
         VALUES ('old', 'user_alice', 'Old', 0, 1, 1)`,
      )
      .run();
    expect(await summary('old')).toMatchObject({ opensIn: null, boardType: null });
  });

  it('reads a stored value outside the enums as unknown', async () => {
    await create('d1', { intent: { mode: 'draw' } });
    db.sql
      .prepare("UPDATE documents SET opens_in = 'retired', board_type = 'gone' WHERE id = 'd1'")
      .run();
    expect(await summary('d1')).toMatchObject({ opensIn: null, boardType: null });
  });

  it("carries the source's record into a copy", async () => {
    await create('d1', { intent: { mode: 'diagram', boardType: 'kanban' } });
    await copyDocument(db.env, 'd1', 'd2', 'user_alice', 'Copy');
    expect({ ...stored('d2') }).toEqual({ opens_in: 'diagram', board_type: 'kanban' });
  });
});
