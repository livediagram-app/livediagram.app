import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { DOCUMENT_CONVERSION_HEADER } from '@livedocuments/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { deleteAccount } from './account';
import { deleteDocument } from './documents';
import { upsertTab } from './tabs';

// Deleting a document for good removes its D1 row (the Inbox's index rows cascade from it) and everything its
// document stored (docs/specs/015-api/api.md "Storage", "Purging a room"). Each document holds its own tabs, so another
// document's content is never touched. Proven on a real SQLite with foreign keys on.

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', teamId: string | null = null) {
  insert(sql, 'documents', {
    id,
    owner_id: ownerId,
    name: id,
    shareable: 0,
    team_id: teamId,
    saved_at: T0,
    created_at: T0,
  });
}

// A tab created in `documentId` through the real autosave path, holding one action the document pushes to the
// Inbox's index.
async function tab(db: SqliteD1, documentId: string, id: string): Promise<void> {
  await upsertTab(
    db.env,
    documentId,
    {
      id,
      name: id,
      elements: [
        {
          id: `el-${id}`,
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          label: 'Box',
          action: {
            id: `act-${id}`,
            name: 'Do it',
            description: '',
            assignee: { userId: 'owner', name: 'Owner' },
            teamId: null,
            assignerId: 'owner',
            assignerName: 'Owner',
            status: 'open',
            createdAt: T0,
            updatedAt: T0,
          },
        } as never,
      ],
    },
    0,
  );
}

function count(sql: DatabaseSync, table: string, where: string, ...args: string[]): number {
  return Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args)?.n);
}

// Everything a document holds of a tab, and the index rows D1 keeps for it.
async function tabFootprint(db: SqliteD1, id: string) {
  // Reading D1 lets the documents' push land first (test-sqlite-d1.ts).
  await db.env.DB.prepare('SELECT 1').first();
  return {
    body: count(db.sql, 'tabs', 'id = ?', id),
    actions: count(db.sql, 'collab_actions', 'tab_id = ?', id),
    links: db.sql
      .prepare('SELECT document_id FROM document_tabs WHERE tab_id = ? ORDER BY document_id')
      .all(id)
      .map((r) => r.document_id),
  };
}

const GONE = { body: 0, actions: 0, links: [] };

describe('deleteDocument', () => {
  it('removes its tabs, with their index rows', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');
    expect(await tabFootprint(db, 't1')).toEqual({ body: 1, actions: 1, links: ['A'] });

    await deleteDocument(db.env, 'A');

    expect(count(db.sql, 'documents', 'id = ?', 'A')).toBe(0);
    expect(count(db.sql, 'document', 'id = ?', 'A')).toBe(0);
    expect(await tabFootprint(db, 't1')).toEqual(GONE);
  });

  it("leaves another document's tabs exactly as they are", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 'a1');
    await tab(db, 'B', 'b1');

    await deleteDocument(db.env, 'A');

    expect(await tabFootprint(db, 'a1')).toEqual(GONE);
    expect(await tabFootprint(db, 'b1')).toEqual({ body: 1, actions: 1, links: ['B'] });
  });
});

// Removal proper is the permanent delete (a plain delete moves the document to
// the Trash, docs/specs/013-workspace/trash.md) and Take Offline.
describe('DELETE /api/documents/:id?permanent=true', () => {
  function del(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2]) {
    return handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/A?permanent=true', { env: db.env, ...opts }),
    );
  }

  it('removes the content when the owner deletes from the Explorer', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 'a1');

    const res = await del(db, { owner: 'owner' });

    expect(res?.status).toBe(204);
    expect(await tabFootprint(db, 'a1')).toEqual(GONE);
  });

  it('removes the content when a teammate deletes a team document', async () => {
    const db = sqliteD1();
    insert(db.sql, 'teams', { id: 'team', name: 'Team', created_at: T0, updated_at: T0 });
    insert(db.sql, 'team_members', {
      id: 'm-bob',
      team_id: 'team',
      user_id: 'user_bob',
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
    liveDoc(db.sql, 'A', 'user_alice', 'team');
    await tab(db, 'A', 'a1');

    const res = await del(db, { owner: 'user_bob', accountUserId: 'user_bob' });

    expect(res?.status).toBe(204);
    expect(await tabFootprint(db, 'a1')).toEqual(GONE);
  });

  it('removes the document when it is taken offline', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 'a1');

    const res = await del(db, {
      owner: 'owner',
      headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });

    expect(res?.status).toBe(204);
    expect(count(db.sql, 'documents', 'id = ?', 'A')).toBe(0);
    expect(await tabFootprint(db, 'a1')).toEqual(GONE);
  });
});

describe('deleteAccount', () => {
  it("removes the leaver's documents' content and keeps everyone else's", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'mine', 'user_leaver');
    liveDoc(db.sql, 'theirs', 'user_stays');
    await tab(db, 'mine', 'private');
    await tab(db, 'theirs', 'kept');

    await deleteAccount(db.env, 'user_leaver');

    expect(await tabFootprint(db, 'private')).toEqual(GONE);
    expect(await tabFootprint(db, 'kept')).toEqual({ body: 1, actions: 1, links: ['theirs'] });
  });
});
