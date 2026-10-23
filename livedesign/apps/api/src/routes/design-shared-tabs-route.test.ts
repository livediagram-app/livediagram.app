import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// GET /api/designs/:id/shared-tabs: what the delete and Take Offline
// confirmations say about tabs that stay behind
// (docs/specs/006-design/tab-design-many-to-many.md, "Shared-tab notice").
// Answered for exactly the callers who may delete the design.

const T0 = 1_700_000_000_000;

function row(sql: DatabaseSync, table: string, values: Record<string, string | number | null>) {
  const cols = Object.keys(values);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(values));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', teamId: string | null = null) {
  row(sql, 'designs', {
    id,
    owner_id: ownerId,
    name: id,
    shareable: 0,
    team_id: teamId,
    saved_at: T0,
    created_at: T0,
  });
}

function tabIn(sql: DatabaseSync, tabId: string, ...designIds: string[]) {
  row(sql, 'tabs', { id: tabId, name: tabId, data: '{"elements":[]}', updated_at: T0 });
  designIds.forEach((d, i) =>
    row(sql, 'design_tabs', { design_id: d, tab_id: tabId, order_index: i, added_at: T0 }),
  );
}

function get(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2] = {}) {
  return handleDesigns(
    makeTestRouteContext('GET', '/api/designs/A/shared-tabs', { env: db.env, ...opts }),
  );
}

describe('GET /api/designs/:id/shared-tabs', () => {
  it('counts the tabs also in other designs, and those designs', async () => {
    const db = sqliteD1();
    for (const id of ['A', 'B', 'C']) liveDoc(db.sql, id);
    tabIn(db.sql, 'glossary', 'A', 'B');
    tabIn(db.sql, 'timeline', 'A', 'B', 'C');
    tabIn(db.sql, 'solo', 'A');
    tabIn(db.sql, 'elsewhere', 'B', 'C');

    const res = await get(db, { owner: 'owner' });

    expect(res?.status).toBe(200);
    expect(await res.json()).toEqual({ sharedTabs: { tabs: 2, designs: 2 } });
  });

  it('answers zero for a design that shares nothing', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    tabIn(db.sql, 'solo', 'A');

    const res = await get(db, { owner: 'owner' });

    expect(await res.json()).toEqual({ sharedTabs: { tabs: 0, designs: 0 } });
  });

  it('answers a joined teammate, who may delete a team design', async () => {
    const db = sqliteD1();
    row(db.sql, 'teams', { id: 'team', name: 'Team', created_at: T0, updated_at: T0 });
    row(db.sql, 'team_members', {
      id: 'm-bob',
      team_id: 'team',
      user_id: 'user_bob',
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
    liveDoc(db.sql, 'A', 'user_alice', 'team');

    const res = await get(db, { owner: 'user_bob', clerkUserId: 'user_bob' });

    expect(res?.status).toBe(200);
  });

  it('refuses anyone who may not delete it', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');

    expect((await get(db, { owner: 'stranger' }))?.status).toBe(403);
    expect((await get(db))?.status).toBe(400);
  });

  it('is a 404 for a missing design', async () => {
    const db = sqliteD1();

    expect((await get(db, { owner: 'owner' }))?.status).toBe(404);
  });
});
