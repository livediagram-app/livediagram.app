import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// GET /api/documents/:id/shared-tabs: what the delete and Take Offline
// confirmations say about tabs that stay behind
// (docs/specs/006-document/tab-document-many-to-many.md, "Shared-tab notice").
// Answered for exactly the callers who may delete the document.

const T0 = 1_700_000_000_000;

function row(sql: DatabaseSync, table: string, values: Record<string, string | number | null>) {
  const cols = Object.keys(values);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(values));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', teamId: string | null = null) {
  row(sql, 'test_documents', {
    id,
    owner_id: ownerId,
    name: id,
    team_id: teamId,
    saved_at: T0,
    created_at: T0,
  });
}

function tabIn(sql: DatabaseSync, tabId: string, ...documentIds: string[]) {
  row(sql, 'tabs', {
    id: tabId,
    name: tabId,
    data: '{"elements":[]}',
    updated_at: T0,
    element_count: 0,
  });
  documentIds.forEach((d, i) =>
    row(sql, 'document_tabs', { document_id: d, tab_id: tabId, order_index: i, added_at: T0 }),
  );
}

function get(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2] = {}) {
  return handleDocuments(
    makeTestRouteContext('GET', '/api/documents/A/shared-tabs', { env: db.env, ...opts }),
  );
}

// The other documents a tab of A's is shared with, as A's room lists them (document-room/tab-shares.ts).
function sharedWith(sql: DatabaseSync, tabId: string, ...documentIds: string[]) {
  for (const d of documentIds) row(sql, 'tab_shares', { tab_id: tabId, item_id: d });
}

describe('GET /api/documents/:id/shared-tabs', () => {
  it('counts the tabs also in other documents, and those documents', async () => {
    const db = sqliteD1();
    for (const id of ['A', 'B', 'C']) liveDoc(db.sql, id);
    tabIn(db.sql, 'glossary', 'A');
    sharedWith(db.sql, 'glossary', 'B');
    tabIn(db.sql, 'timeline', 'A');
    sharedWith(db.sql, 'timeline', 'B', 'C');
    tabIn(db.sql, 'solo', 'A');

    const res = await get(db, { owner: 'owner' });

    expect(res?.status).toBe(200);
    expect(await res.json()).toEqual({ sharedTabs: { tabs: 2, documents: 2 } });
  });

  it('answers zero for a document that shares nothing', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    tabIn(db.sql, 'solo', 'A');

    const res = await get(db, { owner: 'owner' });

    expect(await res.json()).toEqual({ sharedTabs: { tabs: 0, documents: 0 } });
  });

  it('answers a joined teammate, who may delete a team document', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A', 'user_alice', 'team');

    const res = await get(db, {
      owner: 'user_bob',
      accountUserId: 'user_bob',
      teams: [{ id: 'team', name: 'Team', role: 'member' }],
    });

    expect(res?.status).toBe(200);
  });

  it('refuses anyone who may not delete it', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');

    expect((await get(db, { owner: 'stranger' }))?.status).toBe(403);
    expect((await get(db))?.status).toBe(400);
  });

  it('answers a missing document as one the caller may not edit (no existence leak)', async () => {
    const db = sqliteD1();

    expect((await get(db, { owner: 'owner' }))?.status).toBe(403);
  });
});
