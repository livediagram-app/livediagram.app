import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { deleteAccount } from './account';
import { deleteDocument } from './documents';
import { deleteTabRow, linkTabToDocument, upsertTab } from './tabs';

// Deleting a diagram removes its links, never a tab another diagram still
// holds (docs/specs/006-document/tab-document-many-to-many.md, "Delete a
// diagram"). Proven on a real SQLite with foreign keys on: the loss this
// guards against was a five-table cascade that no recorded-SQL test could see.

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

// A tab created in `diagramId` through the real autosave path, with one
// history entry and one collaboration-index row hanging off it.
async function tab(db: SqliteD1, documentId: string, id: string): Promise<void> {
  await upsertTab(db.env, documentId, { id, name: id, elements: [] } as unknown as Tab, 0);
  insert(db.sql, 'change_log', {
    id: `log-${id}`,
    tab_id: id,
    participant_id: 'owner',
    kind: 'edit',
    summary: 'Edited',
    element_ids: '[]',
    before_state: '{}',
    after_state: '{}',
    created_at: T0,
  });
  insert(db.sql, 'collab_actions', {
    tab_id: id,
    element_id: `el-${id}`,
    action_id: `act-${id}`,
    element_label: 'Box',
    name: 'Do it',
    description: '',
    status: 'open',
    assigner_id: 'owner',
    created_at: T0,
    updated_at: T0,
  });
}

function count(sql: DatabaseSync, table: string, where: string, ...args: string[]): number {
  return Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args)?.n);
}

// Everything a tab owns, so a survivor is checked whole rather than by body.
function tabFootprint(sql: DatabaseSync, id: string) {
  return {
    body: count(sql, 'tabs', 'id = ?', id),
    history: count(sql, 'change_log', 'tab_id = ?', id),
    actions: count(sql, 'collab_actions', 'tab_id = ?', id),
    links: sql
      .prepare('SELECT document_id FROM document_tabs WHERE tab_id = ? ORDER BY document_id')
      .all(id)
      .map((r) => r.document_id),
  };
}

const GONE = { body: 0, history: 0, actions: 0, links: [] };

describe('deleteDocument', () => {
  it('removes the tabs only it holds, with their history and index rows', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    await tab(db, 'A', 't1');

    await deleteDocument(db.env, 'A');

    expect(count(db.sql, 'documents', 'id = ?', 'A')).toBe(0);
    expect(tabFootprint(db.sql, 't1')).toEqual(GONE);
  });

  it('keeps a tab it shares with another diagram, whole', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 'shared');
    await linkTabToDocument(db.env, 'B', 'shared');

    await deleteDocument(db.env, 'A');

    expect(tabFootprint(db.sql, 'shared')).toEqual({
      body: 1,
      history: 1,
      actions: 1,
      links: ['B'],
    });
  });

  it('keeps a tab that was unlinked from the diagram it was created in', async () => {
    // The tab no longer shows in A at all, so deleting A must not touch it.
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    liveDoc(db.sql, 'C');
    await tab(db, 'A', 'wanderer');
    await linkTabToDocument(db.env, 'B', 'wanderer');
    await linkTabToDocument(db.env, 'C', 'wanderer');
    await deleteTabRow(db.env, 'A', 'wanderer');

    await deleteDocument(db.env, 'A');

    expect(tabFootprint(db.sql, 'wanderer')).toEqual({
      body: 1,
      history: 1,
      actions: 1,
      links: ['B', 'C'],
    });
  });

  it('leaves the survivor where it sits in the other diagram', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'B', 'own');
    await tab(db, 'A', 'shared');
    await linkTabToDocument(db.env, 'B', 'shared');
    db.sql.prepare("UPDATE document_tabs SET folder = 'Ref' WHERE tab_id = 'shared'").run();

    await deleteDocument(db.env, 'A');

    const row = db.sql
      .prepare(
        "SELECT order_index, folder FROM document_tabs WHERE document_id = 'B' AND tab_id = 'shared'",
      )
      .get();
    expect({ ...row }).toEqual({ order_index: 1, folder: 'Ref' });
  });

  it('removes a shared tab once the last diagram holding it goes', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await tab(db, 'A', 'shared');
    await linkTabToDocument(db.env, 'B', 'shared');

    await deleteDocument(db.env, 'A');
    await deleteDocument(db.env, 'B');

    expect(tabFootprint(db.sql, 'shared')).toEqual(GONE);
  });
});

// Removal proper is the permanent delete (a plain delete moves the diagram to
// the Trash, docs/specs/013-workspace/trash.md) and Take Offline.
describe('DELETE /api/diagrams/:id?permanent=true with a shared tab', () => {
  function del(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2]) {
    return handleDocuments(
      makeTestRouteContext('DELETE', '/api/diagrams/A?permanent=true', { env: db.env, ...opts }),
    );
  }

  async function sharedFromA(db: SqliteD1, ownerId: string, teamId: string | null = null) {
    liveDoc(db.sql, 'A', ownerId, teamId);
    liveDoc(db.sql, 'B', ownerId);
    await tab(db, 'A', 'shared');
    await linkTabToDocument(db.env, 'B', 'shared');
  }

  it('keeps the tab when the owner deletes from the Explorer', async () => {
    const db = sqliteD1();
    await sharedFromA(db, 'owner');

    const res = await del(db, { owner: 'owner' });

    expect(res?.status).toBe(204);
    expect(tabFootprint(db.sql, 'shared').links).toEqual(['B']);
    expect(tabFootprint(db.sql, 'shared').body).toBe(1);
  });

  it('keeps the tab when a teammate deletes a team diagram', async () => {
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
    await sharedFromA(db, 'user_alice', 'team');

    const res = await del(db, { owner: 'user_bob', clerkUserId: 'user_bob' });

    expect(res?.status).toBe(204);
    expect(tabFootprint(db.sql, 'shared')).toEqual({
      body: 1,
      history: 1,
      actions: 1,
      links: ['B'],
    });
  });

  it('keeps the tab when the diagram is taken offline', async () => {
    const db = sqliteD1();
    await sharedFromA(db, 'owner');

    const res = await del(db, {
      owner: 'owner',
      headers: { [DOCUMENT_CONVERSION_HEADER]: 'offline' },
    });

    expect(res?.status).toBe(204);
    expect(count(db.sql, 'documents', 'id = ?', 'A')).toBe(0);
    expect(tabFootprint(db.sql, 'shared').links).toEqual(['B']);
    expect(tabFootprint(db.sql, 'shared').body).toBe(1);
  });
});

describe('deleteAccount with a tab shared into someone else’s diagram', () => {
  it('keeps the shared tab and removes the rest', async () => {
    // A diagram moved out of a team, or transferred on a teammate's account
    // deletion, can hold a tab whose other diagrams belong to the leaver.
    const db = sqliteD1();
    liveDoc(db.sql, 'mine', 'user_leaver');
    liveDoc(db.sql, 'theirs', 'user_stays');
    await tab(db, 'mine', 'private');
    await tab(db, 'mine', 'shared');
    await linkTabToDocument(db.env, 'theirs', 'shared');

    await deleteAccount(db.env, 'user_leaver');

    expect(tabFootprint(db.sql, 'private')).toEqual(GONE);
    expect(tabFootprint(db.sql, 'shared')).toEqual({
      body: 1,
      history: 1,
      actions: 1,
      links: ['theirs'],
    });
  });
});
