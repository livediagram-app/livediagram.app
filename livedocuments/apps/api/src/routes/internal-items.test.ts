import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment, Tab } from '@livedocuments/document';
import { INDEX_ON } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { upsertTab } from '../db/tabs';
import { liveDoc } from '../db/test-image-fixtures';
import { handleInternalItems } from './internal-items';

const { tellTrashed } = vi.hoisted(() => ({
  tellTrashed: vi.fn(async (_env: unknown, _id: string, _kind: string) => true),
}));
vi.mock('../room-access-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../room-access-client')>()),
  tellTrashed,
}));

// The index's copy door (docs/specs/015-api/api.md "Internal"): a copy made by anyone but the source's owner takes
// the comments as the tab read serves them to that person, other people's author ids redacted.

const OWNER = 'user_ada';
const BOB = 'user_bob';

let db: SqliteD1;

beforeEach(() => {
  db = sqliteD1(INDEX_ON);
});

const comment = (id: string, authorId: string): Comment => ({
  id,
  text: 't',
  createdAt: 1,
  authorName: id,
  authorColor: '#000',
  authorId,
});

const tabWithComments = (): Tab =>
  ({
    id: 't1',
    name: 'One',
    elements: [
      {
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        commentThread: { comments: [comment('c1', OWNER), comment('c2', BOB)], resolved: false },
      },
    ],
  }) as unknown as Tab;

async function copy(from: string, to: string, body: Record<string, unknown>) {
  return handleInternalItems(
    new Request(`https://api.test/api/internal/items/${from}/copy-to/${to}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ldoc-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    db.env,
  );
}

const copiedAuthors = (documentId: string): (string | undefined)[] => {
  const row = db.sql
    .prepare(
      'SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = ?',
    )
    .get(documentId) as { data: string };
  const tab = JSON.parse(row.data) as {
    elements: { commentThread: { comments: Comment[] } }[];
  };
  return tab.elements[0]!.commentThread.comments.map((c) => c.authorId);
};

describe('the copy door', () => {
  beforeEach(async () => {
    liveDoc(db.sql, 'S', OWNER);
    await upsertTab(db.env, 'S', tabWithComments(), 0);
  });

  it("redacts other people's comment authors when someone other than the owner copies", async () => {
    expect((await copy('S', 'C', { by: BOB })).status).toBe(201);
    expect(copiedAuthors('C')).toEqual([undefined, BOB]);
  });

  it('keeps every author when the owner copies', async () => {
    expect((await copy('S', 'C', { by: OWNER })).status).toBe(201);
    expect(copiedAuthors('C')).toEqual([OWNER, BOB]);
  });
});

// docs/specs/013-workspace/trash.md "Open editors": the index pushes where an item stands after every trash (the api,
// MCP or the Explorer alike), and a trashed document's room tells its editors and closes.
describe('POST /api/internal/items/:id/standing', () => {
  it("tells a trashed document's room, and never an archived or restored one's", async () => {
    tellTrashed.mockClear();
    const stand = (id: string, archived: boolean, trashed: boolean) =>
      handleInternalItems(
        new Request(`https://api.test/api/internal/items/${id}/standing`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${'ldoc-key'}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived, trashed, at: 1 }),
        }),
        db.env,
      );
    expect((await stand('A', false, true))?.status).toBe(200);
    expect((await stand('B', true, false))?.status).toBe(200);
    expect((await stand('C', false, false))?.status).toBe(200);
    expect(tellTrashed.mock.calls.map(([, id, op]) => [id, op])).toEqual([
      ['A', 'document-trashed'],
    ]);
  });
});
