import { beforeEach, describe, expect, it } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { PROJECT_DESCRIPTION_MAX } from '@liveplanner/api-schema';
import { getProject } from '../db';
import { exportPlanCopy } from '../plan-room/plan-content';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/plan-overview.md "The description" and "Share roles": PUT /api/projects/:id/details stores the
// plan's description for a whole-plan Editor, trimmed and capped, relays it to the room, and refuses a Participant, a
// Viewer and a tab-scoped Editor.

let sql: SqliteD1;
let relayed: unknown[];

async function put(body: unknown, as: { owner?: string; code?: string } = {}, method = 'PUT') {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, '/api/projects/d1/details', {
    env: sql.env,
    owner: as.owner ?? 'owner',
    ...(as.code ? { headers: { 'X-Share-Code': as.code } } : {}),
    body,
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as { description?: string } };
}

beforeEach(() => {
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init?: RequestInit) => {
        relayed.push(init?.body ? sentJson(init) : null);
        return new Response(null, { status: 204 });
      },
    }),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
});

describe('PUT /api/projects/:id/details', () => {
  it('reads no description on a plan that never had one', async () => {
    expect((await getProject(sql.env, 'd1'))!.description).toBeUndefined();
  });

  it('stores the description trimmed, answers it and reads it with the plan', async () => {
    const res = await put({ description: '  Where every bug lands.\nThen fixed.  ' });
    expect(res).toEqual({
      status: 200,
      body: { description: 'Where every bug lands.\nThen fixed.' },
    });
    expect((await getProject(sql.env, 'd1'))!.description).toBe(
      'Where every bug lands.\nThen fixed.',
    );
  });

  it('relays the stored description to the room', async () => {
    await put({ description: 'Bugs' });
    expect(JSON.stringify(relayed)).toContain('"kind":"project-details"');
    expect(JSON.stringify(relayed)).toContain('"description":"Bugs"');
  });

  it('caps a long description', async () => {
    const res = await put({ description: 'x'.repeat(PROJECT_DESCRIPTION_MAX + 10) });
    expect(res.body.description).toHaveLength(PROJECT_DESCRIPTION_MAX);
  });

  it('clears the description with an empty one', async () => {
    await put({ description: 'Bugs' });
    await put({ description: '   ' });
    expect((await getProject(sql.env, 'd1'))!.description).toBeUndefined();
  });

  it('refuses a body without a description', async () => {
    expect((await put({ description: 3 })).status).toBe(400);
    expect((await put({})).status).toBe(400);
  });

  it('answers only PUT', async () => {
    expect((await put({ description: 'x' }, {}, 'POST')).status).toBe(405);
  });

  it('lets a whole-plan Editor write it and refuses a Participant, a Viewer and a tab-scoped Editor', async () => {
    expect((await put({ description: 'v' }, { owner: 'v', code: 'VIEW' })).status).toBe(403);
    expect((await put({ description: 'p' }, { owner: 'p', code: 'PART' })).status).toBe(403);
    expect((await put({ description: 't' }, { owner: 't', code: 'TAB1' })).status).toBe(403);
    expect((await put({ description: 'e' }, { owner: 'e', code: 'EDIT' })).status).toBe(200);
    expect((await getProject(sql.env, 'd1'))!.description).toBe('e');
  });

  it('answers 404 for a plan that is not there', async () => {
    const ctx = makeTestRouteContext('PUT', '/api/projects/nope/details', {
      env: sql.env,
      owner: 'owner',
      body: { description: 'x' },
    });
    expect((await handleProjects(ctx)).status).toBe(404);
  });

  it('carries the description in a whole-plan copy, never a tab-scoped one', async () => {
    await put({ description: 'Bugs' });
    expect((await exportPlanCopy(sql.env, 'd1', null, null))?.description).toBe('Bugs');
    expect((await exportPlanCopy(sql.env, 'd1', 't1', null))?.description).toBeUndefined();
  });
});
