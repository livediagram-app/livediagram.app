import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse } from '@liveplanner/api-schema';
import { presetSetup } from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/item-types.md "Blocked By": only an Editor sets a card's blockers, and no write closes a loop,
// whether it makes a card, edits one, edits several or moves one.

let sql: SqliteD1;

async function call<T = unknown>(opts: {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string;
  code?: string;
}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'POST', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: opts.owner ?? 'owner',
    ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
    ...(opts.body === undefined ? {} : { body: opts.body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const BLOCKED_BY = 'f-blocked-by';
const catalogue = {
  version: 1,
  types: [
    {
      id: 'task',
      label: 'Task',
      color: '#71717a',
      glyph: 'task',
      fields: ['title', 'status', BLOCKED_BY],
      custom: [
        {
          id: BLOCKED_BY,
          label: 'Blocked By',
          kind: 'card',
          linkType: 'task',
          multiple: true,
          blocks: true,
        },
      ],
    },
  ],
};
const PART = { owner: 'p', code: 'PART' };
const add = (title: string, blockers?: string[], as: { owner?: string; code?: string } = {}) =>
  call<ItemResponse>({
    ...as,
    path: '/items',
    body: {
      type: 'task',
      fields: { title, status: 'todo', ...(blockers ? { [BLOCKED_BY]: blockers } : {}) },
    },
  });

beforeEach(async () => {
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('kanban'),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  expect(
    (await call({ method: 'PUT', path: '/item-types', body: { itemTypes: catalogue } })).status,
  ).toBe(200);
});

describe('Blocked By through the api', () => {
  it('lets an Editor set blockers and refuses a loop by patch, with its sentence', async () => {
    const a = (await add('Website')).body.item;
    const b = (await add('Launch', [a.id])).body.item;
    expect(b.fields[BLOCKED_BY]).toEqual([a.id]);
    const loop = await call({ path: `/items/${a.id}`, body: { set: { [BLOCKED_BY]: [b.id] } } });
    expect(loop).toEqual({
      status: 400,
      body: {
        error: 'blocks_cycle',
        id: a.id,
        field: BLOCKED_BY,
        message: `#${b.key} Launch already waits on #${a.key} Website, so it can't block it.`,
      },
    });
    // Removing a link is never refused.
    expect((await call({ path: `/items/${b.id}`, body: { clear: [BLOCKED_BY] } })).status).toBe(
      200,
    );
    expect(
      (await call({ path: `/items/${a.id}`, body: { set: { [BLOCKED_BY]: [b.id] } } })).status,
    ).toBe(200);
  });

  it('refuses a loop closed through several cards, by patches', async () => {
    const a = (await add('A')).body.item;
    const b = (await add('B', [a.id])).body.item;
    const c = (await add('C', [b.id])).body.item;
    const res = await call<{ error: string; message: string }>({
      path: '/items/patches',
      body: { items: [{ id: a.id, set: { [BLOCKED_BY]: [c.id] } }] },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('blocks_cycle');
    expect(res.body.message).toContain(`through #${b.key} B`);
    // A batch that closes nothing lands.
    const d = (await add('D')).body.item;
    expect(
      (
        await call({
          path: '/items/patches',
          body: { items: [{ id: d.id, set: { [BLOCKED_BY]: [c.id] } }] },
        })
      ).status,
    ).toBe(200);
  });

  it('refuses a create that closes a loop: a card put back with its id', async () => {
    const waiting = (await add('Waiting', ['back01'])).body.item;
    const res = await call({
      path: '/items',
      body: {
        type: 'task',
        id: 'back01',
        fields: { title: 'Back', status: 'todo', [BLOCKED_BY]: [waiting.id] },
      },
    });
    expect(res.status).toBe(400);
    const bulk = await call({
      path: '/items/bulk',
      body: {
        items: [
          {
            type: 'task',
            id: 'back01',
            fields: { title: 'Back', status: 'todo', [BLOCKED_BY]: [waiting.id] },
          },
        ],
      },
    });
    expect(bulk.status).toBe(400);
  });

  // docs/specs/013-workspace/share-roles.md: an Editor sets links; a Participant and a Viewer read them.
  it('lets a Participant read blockers and edit the card, but never set them', async () => {
    const a = (await add('A')).body.item;
    const b = (await add('B', [a.id])).body.item;
    expect((await add('Mine', [a.id], PART)).status).toBe(403);
    expect((await add('Mine', undefined, PART)).status).toBe(201);
    expect(
      (
        await call({
          ...PART,
          path: `/items/${b.id}`,
          body: { set: { [BLOCKED_BY]: [b.id, a.id] } },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call({ ...PART, path: `/items/${b.id}`, body: { clear: [BLOCKED_BY] } })).status,
    ).toBe(403);
    expect(
      (
        await call({
          ...PART,
          path: '/items/patches',
          body: { items: [{ id: a.id, set: { [BLOCKED_BY]: [b.id] } }] },
        })
      ).status,
    ).toBe(403);
    // Any other edit, and a move, still land.
    expect(
      (await call({ ...PART, path: `/items/${b.id}`, body: { set: { title: 'B2' } } })).status,
    ).toBe(200);
    expect(
      (await call({ ...PART, path: `/items/${b.id}/move`, body: { status: 'done' } })).status,
    ).toBe(200);
    const read = await call<{ items: { id: string; fields: Record<string, unknown> }[] }>({
      ...PART,
      method: 'GET',
      path: '/items',
    });
    expect(read.body.items.find((i) => i.id === b.id)?.fields[BLOCKED_BY]).toEqual([a.id]);
    const viewer = await call<{ items: unknown[] }>({
      owner: 'v',
      code: 'VIEW',
      method: 'GET',
      path: '/items',
    });
    expect(viewer.status).toBe(200);
    expect(
      (
        await call({
          owner: 'v',
          code: 'VIEW',
          path: `/items/${b.id}`,
          body: { clear: [BLOCKED_BY] },
        })
      ).status,
    ).toBe(403);
  });
});
