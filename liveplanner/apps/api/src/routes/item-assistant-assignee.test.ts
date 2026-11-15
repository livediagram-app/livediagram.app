import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse } from '@liveplanner/api-schema';
import { itemAssistantFor, presetSetup, type Item } from '@liveplanner/items';
import { listItems } from '../db/items';
import { exportPlanCopy, importPlanCopy } from '../plan-room/plan-copy';
import { exportProjectFile, readProjectFile } from '../plan-room/project-file';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/items.md "Handing a card to an AI assistant": an Editor or a Participant hands a card to an AI
// assistant and back, a Viewer can't (docs/specs/013-workspace/share-roles.md); the api checks the assistant whole;
// a copy, a Drive file and its import keep it, and a Community copy drops it with every person.

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

const THOMAS = { id: 'a1b2c3d4e5f6a1b2c3d4e5f6', name: 'Thomas', color: '#2563eb' };
const CLAUDE = itemAssistantFor(THOMAS, 'Claude')!;

const EDIT = { owner: 'e', code: 'EDIT' };
const PART = { owner: 'p', code: 'PART' };
const VIEW = { owner: 'v', code: 'VIEW' };

const make = (fields: Record<string, unknown>, as: { owner?: string; code?: string } = {}) =>
  call<ItemResponse>({
    ...as,
    path: '/items',
    body: { type: 'task', fields: { title: 'Fix login', ...fields }, place: { status: 'todo' } },
  });
const patch = (id: string, set: Record<string, unknown>, as: { owner?: string; code?: string }) =>
  call<ItemResponse & { error?: string }>({ ...as, path: `/items/${id}`, body: { set } });
const assigneeOf = async (planId: string, id: string) =>
  (await listItems(sql.env, planId)).find((i: Item) => i.id === id)?.fields['assignee'];

beforeEach(() => {
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
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
});

describe('handing a card to an AI assistant', () => {
  it('lets an Editor and a Participant hand a card over and back, and keeps it whole', async () => {
    for (const as of [EDIT, PART]) {
      const card = await make({}, as);
      expect(card.status, as.code).toBe(201);
      const handed = await patch(card.body.item.id, { assignee: CLAUDE }, as);
      expect(handed.status, as.code).toBe(200);
      expect(await assigneeOf('d1', card.body.item.id)).toEqual(CLAUDE);
      // Handing it back is assigning its person.
      expect((await patch(card.body.item.id, { assignee: THOMAS }, as)).status).toBe(200);
      expect(await assigneeOf('d1', card.body.item.id)).toEqual(THOMAS);
    }
    const made = await make({ assignee: CLAUDE }, PART);
    expect(made.status).toBe(201);
    expect(made.body.item.fields['assignee']).toEqual(CLAUDE);
  });

  it('refuses a Viewer, on a new card and an old one', async () => {
    expect((await make({ assignee: CLAUDE }, VIEW)).status).toBe(403);
    const card = await make({});
    expect((await patch(card.body.item.id, { assignee: CLAUDE }, VIEW)).status).toBe(403);
    expect(await assigneeOf('d1', card.body.item.id)).toBeUndefined();
  });

  it('refuses one that does not read as an assistant, keeping the card as it was', async () => {
    const card = await make({ assignee: THOMAS });
    const forged = { ...CLAUDE, id: `ai-${THOMAS.id}-cursor` };
    const res = await patch(card.body.item.id, { assignee: forged }, EDIT);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'field_value_invalid' });
    expect(await assigneeOf('d1', card.body.item.id)).toEqual(THOMAS);
  });

  it('reads a card stored before assistants unchanged', async () => {
    const card = await make({ assignee: THOMAS });
    expect(card.body.item.fields['assignee']).toEqual(THOMAS);
    expect(await assigneeOf('d1', card.body.item.id)).toEqual(THOMAS);
  });
});

describe('an AI assistant Assignee in a copy', () => {
  async function copiedInto(planId: string, community: boolean) {
    const card = await make({ assignee: CLAUDE });
    const copy = await exportPlanCopy(sql.env, 'd1', null, null, community);
    sql.sql
      .prepare(
        `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
          VALUES (?, 'owner', 'Copy', 0, 1, 1)`,
      )
      .run(planId);
    await importPlanCopy(sql.env, planId, copy!);
    return (await listItems(sql.env, planId)).find((i) => i.id === card.body.item.id)!;
  }

  it('keeps it in a duplicate', async () => {
    expect((await copiedInto('d2', false)).fields['assignee']).toEqual(CLAUDE);
  });

  it('drops it from a Community copy, with every person', async () => {
    const copied = await copiedInto('d2', true);
    expect(copied.fields['title']).toBe('Fix login');
    expect(copied.fields).not.toHaveProperty('assignee');
    expect(JSON.stringify(copied)).not.toContain('Claude');
  });

  it('keeps it through a Drive export and its import', async () => {
    const card = await make({ assignee: CLAUDE });
    const file = await exportProjectFile(sql.env, 'd1', null);
    if (file.status !== 'ok') throw new Error(file.status);
    const text = typeof file.body === 'string' ? file.body : new TextDecoder().decode(file.body);
    const read = readProjectFile(text);
    if (!read.ok) throw new Error(read.failure);
    sql.sql.exec(`
      INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
        VALUES ('d3', 'owner', 'From Drive', 0, 1, 1);
    `);
    await importPlanCopy(sql.env, 'd3', read.content.copy);
    expect(await assigneeOf('d3', card.body.item.id)).toEqual(CLAUDE);
  });
});
