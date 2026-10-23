import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// GET /api/projects/:id/shared-tabs: what the delete and Take Offline
// confirmations say about tabs that stay behind
// (docs/specs/006-project/tab-project-many-to-many.md, "Shared-tab notice").
// Answered for exactly the callers who may delete the project.

const T0 = 1_700_000_000_000;

function row(sql: DatabaseSync, table: string, values: Record<string, string | number | null>) {
  const cols = Object.keys(values);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(values));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId = 'owner', teamId: string | null = null) {
  row(sql, 'test_plans', {
    id,
    owner_id: ownerId,
    name: id,
    team_id: teamId,
    saved_at: T0,
    created_at: T0,
  });
}

function tabIn(sql: DatabaseSync, tabId: string, ...projectIds: string[]) {
  row(sql, 'tabs', { id: tabId, name: tabId, data: '{"elements":[]}', updated_at: T0 });
  projectIds.forEach((d, i) =>
    row(sql, 'plan_tabs', { plan_id: d, tab_id: tabId, order_index: i, added_at: T0 }),
  );
}

function get(db: SqliteD1, opts: Parameters<typeof makeTestRouteContext>[2] = {}) {
  return handleProjects(
    makeTestRouteContext('GET', '/api/projects/A/shared-tabs', { env: db.env, ...opts }),
  );
}

describe('GET /api/projects/:id/shared-tabs', () => {
  // Each plan holds its own tabs (docs/specs/015-api/api.md "Storage"): nothing is ever shared, so the answer is
  // always none.
  it('answers zero for a project that shares nothing', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'A');
    tabIn(db.sql, 'solo', 'A');

    const res = await get(db, { owner: 'owner' });

    expect(await res.json()).toEqual({ sharedTabs: { tabs: 0, projects: 0 } });
  });

  it('answers a joined teammate, who may delete a team project', async () => {
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

  it('answers a missing project as one the caller may not edit (no existence leak)', async () => {
    const db = sqliteD1();

    expect((await get(db, { owner: 'owner' }))?.status).toBe(403);
  });
});
