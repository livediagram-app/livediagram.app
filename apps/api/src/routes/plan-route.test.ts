import { beforeEach, describe, expect, it } from 'vitest';
import type { PlanResponse } from '@livediagram/api-schema';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { PLAN_TAB_BATCH } from './plan-route';

// The plan route (docs/specs/026-plan/plan-agents.md "Reading the plan"): boards in tab then canvas order, each
// status once, the card types, read access, tab-scoped links and batched tab reads.

let sql: SqliteD1;

async function get(path = '/plan', { owner = 'owner' as string | null, code = '' } = {}) {
  const ctx = makeTestRouteContext('GET', `/api/documents/d1${path}`, {
    env: sql.env,
    owner,
    ...(code ? { headers: { 'X-Share-Code': code } } : {}),
  });
  const res = await handleDocuments(ctx);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as PlanResponse };
}

const board = (id: string, setup: unknown) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  planBoard: setup,
});

function addTab(id: string, order: number, elements: unknown[]) {
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)`)
    .run(id, `Tab ${id}`, JSON.stringify({ elements }));
  sql.sql
    .prepare(
      `INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', ?, ?, 1)`,
    )
    .run(id, order);
}

beforeEach(() => {
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('TAB2', 'd1', 'view', 't2', 1);
  `);
  addTab('t1', 0, [board('b1', presetSetup('kanban'))]);
  addTab('t2', 1, [{ id: 'x', type: 'text' }, board('b2', presetSetup('bug-triage'))]);
});

describe('GET /documents/:id/plan', () => {
  it('answers boards in tab order, each status once and the built-in types', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.boards.map((b) => [b.tabId, b.elementId])).toEqual([
      ['t1', 'b1'],
      ['t2', 'b2'],
    ]);
    expect(res.body.boards[0]!.columns.map((c) => c.name)).toEqual(
      presetSetup('kanban').columns.map((c) => c.name),
    );
    const ids = res.body.statuses.map((s) => s.status);
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.body.types.map((t) => t.id)).toEqual(ITEM_TYPES.map((t) => t.id));
  });

  it('answers a view link, and only its tab to a tab-scoped one', async () => {
    expect((await get('/plan', { owner: 'visitor', code: 'VIEW' })).body.boards).toHaveLength(2);
    const scoped = await get('/plan?tabId=t2', { owner: 'visitor', code: 'TAB2' });
    expect(scoped.body.boards.map((b) => b.elementId)).toEqual(['b2']);
    // Denied as the item list denies it: the tab-scoped grant's 404.
    const items = await get('/items', { owner: 'visitor', code: 'TAB2' });
    expect((await get('/plan', { owner: 'visitor', code: 'TAB2' })).status).toBe(items.status);
    expect((await get('/plan?tabId=t1', { owner: 'visitor', code: 'TAB2' })).status).toBe(404);
  });

  it('refuses a stranger and any method but GET', async () => {
    expect((await get('/plan', { owner: 'stranger' })).status).toBe(403);
    const ctx = makeTestRouteContext('POST', '/api/documents/d1/plan', {
      env: sql.env,
      owner: 'owner',
    });
    expect((await handleDocuments(ctx)).status).toBe(405);
  });

  it('reads every tab past one batch', async () => {
    for (let i = 0; i < PLAN_TAB_BATCH + 3; i++)
      addTab(`m${i}`, 10 + i, [board(`mb${i}`, presetSetup('todo'))]);
    expect((await get()).body.boards).toHaveLength(PLAN_TAB_BATCH + 5);
  });
});
