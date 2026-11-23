import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemResponse } from '@liveplanner/api-schema';
import { ITEM_DESCRIPTION_MAX, ITEM_FIELDS_BYTES, presetSetup } from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/items.md "Limits": a refused value's answer names the field and the limit it broke, and a custom
// Long Text holds 10,000 characters inside a card's 64 KB of fields (Work Tracker 944).

let sql: SqliteD1;

async function call<T = unknown>(opts: { path: string; body?: unknown }) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext('POST', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: 'owner',
    ...(opts.body === undefined ? {} : { body: opts.body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

type Answer = ItemResponse & { error?: string; id?: string; field?: string; limit?: unknown };

const make = (fields: Record<string, unknown>) =>
  call<Answer>({
    path: '/items',
    body: { type: 'task', fields: { title: 'Log it', ...fields }, place: { status: 'todo' } },
  });
const patch = (id: string, set: Record<string, unknown>) =>
  call<Answer>({ path: `/items/${id}`, body: { set } });
const tooLong = (field: string) => ({
  error: 'field_value_invalid',
  field,
  limit: { unit: 'characters', max: 10_000, given: 10_001 },
});
const marked = (n: number) =>
  Array.from({ length: n / 100 }, (_, i) => ({
    text: 'w'.repeat(100),
    ...(i % 2 ? { bold: true } : {}),
  }));

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
  sql.sql.exec(
    `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);`,
  );
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
});

describe('a refused field value', () => {
  it('names the field and the limit on one card’s change and move', async () => {
    const card = await make({});
    const id = card.body.item.id;
    const res = await patch(id, { 'f-solution': 's'.repeat(10_001) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(tooLong('f-solution'));
    const rows = Array.from({ length: 7 }, (_, i) => ({
      text: i === 2 ? 'r'.repeat(230) : 'ok',
      done: false,
    }));
    expect((await patch(id, { checklist: rows })).body).toEqual({
      error: 'field_value_invalid',
      field: 'checklist',
      limit: { unit: 'characters', max: 200, given: 230, row: 3, entry: 'row' },
    });
    const moved = await call<Answer>({
      path: `/items/${id}/move`,
      body: { status: 'doing', set: { 'f-x': 'x'.repeat(10_001) } },
    });
    expect(moved.body).toEqual(tooLong('f-x'));
  });

  it('names the field on a create, one or many, and the item on a many-card change', async () => {
    expect((await make({ title: 't'.repeat(501) })).body).toEqual({
      error: 'title_too_long',
      field: 'title',
      limit: { unit: 'characters', max: 500, given: 501 },
    });
    const bulk = await call<Answer>({
      path: '/items/bulk',
      body: { items: [{ type: 'task', fields: { title: 'A', labels: ['l'.repeat(33)] } }] },
    });
    expect(bulk.body).toMatchObject({ error: 'field_value_invalid', field: 'labels' });
    const id = (await make({})).body.item.id;
    const many = await call<Answer>({
      path: '/items/patches',
      body: { items: [{ id, set: { 'f-s': 's'.repeat(10_001) } }] },
    });
    expect(many.body).toEqual({ ...tooLong('f-s'), id });
    const moves = await call<Answer>({
      path: '/items/moves',
      body: { items: [{ id, status: 'doing', set: { 'f-s': 's'.repeat(10_001) } }] },
    });
    expect(moves.body).toEqual({ ...tooLong('f-s'), id });
    // A refusal that is not a field value's names none.
    expect((await call<Answer>({ path: '/items', body: { type: '', fields: {} } })).body).toEqual({
      error: 'type_invalid',
    });
  });

  it('keeps a formatted 9,000-character Long Text beside a full formatted description', async () => {
    const card = await make({
      description: 'd'.repeat(ITEM_DESCRIPTION_MAX),
      descriptionRich: marked(ITEM_DESCRIPTION_MAX),
    });
    expect(card.status).toBe(201);
    const res = await patch(card.body.item.id, {
      'f-solution': 's'.repeat(9000),
      'f-solutionRich': marked(9000),
    });
    expect(res.status).toBe(200);
    expect(res.body.item.fields['f-solution']).toHaveLength(9000);
    // Past the card's fields budget is still refused.
    const big = Object.fromEntries(
      Array.from({ length: Math.ceil(ITEM_FIELDS_BYTES / 10_000) }, (_, i) => [
        `f-b${i}`,
        'b'.repeat(10_000),
      ]),
    );
    expect((await patch(card.body.item.id, big)).body).toMatchObject({
      error: 'fields_too_large',
    });
  });
});

// With Pro off nothing changes (liveworkspace 019 "The flag"): a card's attachment may state no more than the 10 MiB
// a picture could be before Pro. With Pro on, what any tier's upload may be (25 MB).
describe('an attachment’s stated size', () => {
  const picture = (size: number) => ({
    attachments: [{ id: 'img_1', name: 'shot.png', size, type: 'image/png' }],
  });
  const LEGACY = 10 * 1024 * 1024;

  it('is held to the legacy 10 MiB with Pro off, on a create, a change and a move', async () => {
    expect((await make(picture(LEGACY))).status).toBe(201);
    const over = await make(picture(LEGACY + 1));
    expect(over.status).toBe(400);
    expect(over.body).toMatchObject({ error: 'field_value_invalid', field: 'attachments' });
    const id = (await make({})).body.item.id;
    expect((await patch(id, picture(20_000_000))).body).toMatchObject({
      error: 'field_value_invalid',
      field: 'attachments',
    });
    const many = await call<Answer>({
      path: '/items/bulk',
      body: {
        items: [
          {
            type: 'task',
            fields: { title: 'Two', ...picture(20_000_000) },
            place: { status: 'todo' },
          },
        ],
      },
    });
    expect(many.status).toBe(400);
  });

  it('is what any tier’s upload may be with Pro on', async () => {
    (sql.env as unknown as { PRO_ENABLED: string }).PRO_ENABLED = 'true';
    expect((await make(picture(20_000_000))).status).toBe(201);
    expect((await make(picture(25_000_001))).status).toBe(400);
  });
});
