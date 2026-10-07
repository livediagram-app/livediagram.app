import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import { itemPersonId, presetSetup, type Item } from '@livediagram/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The item store's endpoints (docs/specs/026-plan/items.md, blueprint item-store.md): gates incl.
// tab-scoped links, every rejection, keys never reused, rev guards, votes, the relay, copies.

let sql: SqliteD1;
let relayed: unknown[];

type Call = {
  method?: string;
  path: string;
  body?: unknown;
  owner?: string | null;
  code?: string;
  doc?: string;
};

async function call<T = unknown>({
  method = 'POST',
  path,
  body,
  owner = 'owner',
  code,
  doc = 'd1',
}: Call) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/documents/${doc}${path}`, {
    env: sql.env,
    owner,
    ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    ...(body === undefined ? {} : { body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleDocuments(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const add = (fields: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  call<ItemResponse>({ path: '/items', body: { type: 'task', fields, ...extra } });

beforeEach(() => {
  sql = sqliteD1();
  relayed = [];
  // The room stub records each broadcast body.
  (sql.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      },
    }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql.exec(`
    INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(`
    INSERT INTO participants (id, name, color, created_at) VALUES ('owner', 'Webber', '#3b82f6', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Other', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
  `);
});

describe('creating items', () => {
  it('makes an item with the next key, a hashed author and relays it', async () => {
    const res = await add({ title: ' Fix login ', status: 'todo' });
    expect(res.status).toBe(201);
    const item = res.body.item;
    expect(item).toMatchObject({
      type: 'task',
      key: 1,
      rev: 1,
      fields: { title: 'Fix login', status: 'todo' },
    });
    expect(item.createdBy).toEqual({
      id: await itemPersonId('owner'),
      name: 'Webber',
      color: '#3b82f6',
    });
    expect(item.createdBy.id).not.toBe('owner');
    expect(res.body.rev).toBe(1);
    expect(relayed).toEqual([
      { op: { kind: 'items', upserts: [item], removed: [], rev: 1 }, ordered: true },
    ]);
    const second = await add({ title: 'Two' }, { place: { status: 'todo', after: null } });
    expect(second.body.item.key).toBe(2);
    expect(second.body.item.rank < item.rank).toBe(true);
  });

  it('refuses bad input with named rejections', async () => {
    expect(
      (await call({ path: '/items', body: { type: 'Task', fields: { title: 'x' } } })).body,
    ).toMatchObject({ error: 'type_invalid' });
    expect((await call({ path: '/items', body: { type: 'task', fields: {} } })).body).toMatchObject(
      { error: 'title_required' },
    );
    expect(
      (await call({ path: '/items', body: { type: 'task', fields: { title: 'x', votes: {} } } }))
        .body,
    ).toMatchObject({ error: 'votes_read_only' });
    expect(
      (await call({ path: '/items', body: { type: 'task', id: 'no', fields: { title: 'x' } } }))
        .body,
    ).toMatchObject({ error: 'id_invalid' });
    expect(
      (
        await call({
          path: '/items',
          body: { type: 'task', fields: { title: 'x' }, place: { after: 'x' } },
        })
      ).body,
    ).toMatchObject({ error: 'place_invalid' });
    expect((await call({ path: '/items', body: [] })).status).toBe(400);
    expect(
      (
        await call({
          path: '/items',
          body: { type: 'task', fields: { title: 'x' }, votes: { a: 0 } },
        })
      ).body,
    ).toMatchObject({ error: 'field_value_invalid' });
    const restored = await call<ItemResponse>({
      path: '/items',
      body: { type: 'note', fields: { title: 'kept' }, votes: { a: 2 } },
    });
    expect(restored.body.item.fields['votes']).toEqual({ a: 2 });
  });

  it('refuses a taken id and never reuses a key', async () => {
    const a = await add({ title: 'A' }, { id: 'item-aaaa' });
    expect((await add({ title: 'B' }, { id: 'item-aaaa' })).status).toBe(409);
    await call({ method: 'DELETE', path: `/items/${a.body.item.id}` });
    const c = await add({ title: 'C' });
    expect(c.body.item.key).toBe(2);
    // An undo restores the deleted item's key while it is free.
    const restored = await add({ title: 'A' }, { id: 'item-aaaa', key: 1 });
    expect(restored.body.item.key).toBe(1);
    const clash = await add({ title: 'D' }, { key: 1 });
    expect(clash.body.item.key).toBe(3);
  });

  it('caps the store', async () => {
    sql.sql.exec('UPDATE documents SET items_next_key = 2001');
    const insert = sql.sql.prepare(
      `INSERT INTO items (document_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('d1', ?, 'task', ?, 'i', '{"title":"x"}', 1, 0, 0, '{}', '{}')`,
    );
    for (let i = 1; i <= 2000; i++) insert.run(`seed${String(i).padStart(4, '0')}`, i);
    expect((await add({ title: 'one too many' })).body).toMatchObject({ error: 'items_full' });
  });

  it('bulk creates for the whole document only', async () => {
    const res = await call<ItemsResponse>({
      path: '/items/bulk',
      body: {
        items: [
          { type: 'bug', fields: { title: 'a', status: 'new' } },
          { type: 'bug', fields: { title: 'b', status: 'new' } },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.items.map((i) => i.key)).toEqual([1, 2]);
    expect(res.body.items[1]!.rank > res.body.items[0]!.rank).toBe(true);
    expect((await call({ path: '/items/bulk', body: { items: [] } })).status).toBe(400);
    expect(
      (
        await call({
          path: '/items/bulk?tabId=t1',
          owner: 'visitor',
          code: 'TAB1',
          body: { items: [{ type: 'bug', fields: { title: 'x' } }] },
        })
      ).status,
    ).toBe(403);
  });
});

describe('changing items', () => {
  let item: Item;
  beforeEach(async () => {
    item = (await add({ title: 'A', status: 'todo', due: '2026-01-01' })).body.item;
  });

  it('patches set, clear and type, raising rev', async () => {
    const res = await call<ItemResponse>({
      path: `/items/${item.id}`,
      body: { set: { priority: 'high' }, clear: ['due'], type: 'bug' },
    });
    expect(res.body.item).toMatchObject({
      type: 'bug',
      rev: 2,
      fields: { title: 'A', status: 'todo', priority: 'high' },
    });
    expect(res.body.item.fields['due']).toBeUndefined();
    expect(
      (await call({ path: `/items/${item.id}`, body: { clear: ['title'] } })).body,
    ).toMatchObject({ error: 'title_required' });
    expect((await call({ path: '/items/missing-id', body: { set: { title: 'x' } } })).body).toEqual(
      { error: 'item_not_found' },
    );
  });

  it('moves between columns and sets or clears a swimlane field', async () => {
    const b = (await add({ title: 'B', status: 'done' })).body.item;
    const res = await call<ItemResponse>({
      path: `/items/${item.id}/move`,
      body: { status: 'done', before: b.id, set: { priority: 'low' } },
    });
    expect(res.body.item.fields).toMatchObject({ status: 'done', priority: 'low' });
    expect(res.body.item.rank < b.rank).toBe(true);
    const cleared = await call<ItemResponse>({
      path: `/items/${item.id}/move`,
      body: { clear: ['priority'] },
    });
    expect(cleared.body.item.fields['priority']).toBeUndefined();
    expect(
      (await call({ path: `/items/${item.id}/move`, body: { set: { title: 'no' } } })).body,
    ).toMatchObject({ error: 'place_invalid' });
    // A row of a board laned by a field sets that field (docs/specs/026-plan/plan-board.md).
    const laned = await call<ItemResponse>({
      path: `/items/${item.id}/move`,
      body: { set: { 'f-stage': 'Won', labels: ['auth'] } },
    });
    expect(laned.body.item.fields).toMatchObject({ 'f-stage': 'Won', labels: ['auth'] });
  });

  it('votes per person, never below zero, from a view link too', async () => {
    const mine = await itemPersonId('visitor');
    const vote = (delta: number) =>
      call<ItemResponse>({
        path: `/items/${item.id}/vote`,
        owner: 'visitor',
        code: 'VIEW',
        body: { delta },
      });
    expect((await vote(1)).body.item.fields['votes']).toEqual({ [mine]: 1 });
    await vote(-1);
    expect((await vote(-1)).body.item.fields['votes']).toEqual({});
    expect((await call({ path: `/items/${item.id}/vote`, body: { delta: 2 } })).status).toBe(400);
  });

  // docs/specs/012-collaboration/vote-integrity.md: guest voters are capped per network per document; one already in
  // can keep voting, and taking a vote back is never refused.
  it('caps guest voters per network, and never refuses taking a vote back', async () => {
    const vote = (owner: string, delta: number) =>
      call({ path: `/items/${item.id}/vote`, owner, code: 'VIEW', body: { delta } });
    for (let i = 0; i < 100; i++) expect((await vote(`guest-${i}`, 1)).status).toBe(200);
    const late = await vote('guest-late', 1);
    expect(late.status).toBe(429);
    expect(late.body).toEqual({ error: 'vote_limit' });
    expect((await vote('guest-0', 1)).status).toBe(200);
    expect((await vote('guest-late', -1)).status).toBe(200);
  });

  it('deletes and relays the removal', async () => {
    relayed = [];
    expect((await call({ method: 'DELETE', path: `/items/${item.id}` })).status).toBe(204);
    expect(relayed).toEqual([
      { op: { kind: 'items', upserts: [], removed: [item.id], rev: 2 }, ordered: true },
    ]);
    expect((await call({ method: 'DELETE', path: `/items/${item.id}` })).status).toBe(404);
  });

  it('guards an update by the rev it read', async () => {
    const next = { ...item, rev: 2, fields: { title: 'raced' } };
    expect(await db.updateItemAtRev(sql.env, 'd1', next, 7)).toBeNull();
    expect(await db.updateItemAtRev(sql.env, 'd1', next, 1)).toBe(2);
    expect((await db.readItem(sql.env, 'd1', item.id))!.fields).toEqual({ title: 'raced' });
    expect(await db.deleteItemRow(sql.env, 'd1', 'missing-id')).toBeNull();
  });
});

describe('who may do what', () => {
  it('reads with any access, writes with edit', async () => {
    await add({ title: 'A' });
    expect(
      (await call<ItemsResponse>({ method: 'GET', path: '/items', owner: 'v', code: 'VIEW' })).body
        .items,
    ).toHaveLength(1);
    expect(
      (
        await call({
          path: '/items',
          owner: 'v',
          code: 'VIEW',
          body: { type: 'task', fields: { title: 'x' } },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call({
          path: '/items',
          owner: 'e',
          code: 'EDIT',
          body: { type: 'task', fields: { title: 'x' } },
        })
      ).status,
    ).toBe(201);
    expect((await call({ method: 'GET', path: '/items', owner: 'stranger' })).status).toBe(403);
    expect((await call({ method: 'GET', path: '/items', owner: null })).status).toBe(400);
    expect((await call({ method: 'GET', path: '/items', doc: 'nope' })).status).toBe(404);
  });

  it('confines a tab-scoped link to the items its tab shows', async () => {
    const bug = (
      await call<ItemResponse>({
        path: '/items',
        body: { type: 'task', fields: { title: 'Bug', status: 'new', labels: ['bug'] } },
      })
    ).body.item;
    const task = (await add({ title: 'Task' })).body.item;
    // A tab with a board shows every item; this one holds only a Plan card for the bug.
    sql.sql.prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'`).run(
      JSON.stringify({
        elements: [
          {
            id: 'c1',
            type: 'shape',
            shape: 'plan-card',
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            planCard: { itemId: bug.id },
          },
        ],
      }),
    );
    expect((await call({ method: 'GET', path: '/items', owner: 'v', code: 'TAB1' })).status).toBe(
      404,
    );
    const listed = await call<ItemsResponse>({
      method: 'GET',
      path: '/items?tabId=t1',
      owner: 'v',
      code: 'TAB1',
    });
    expect(listed.body.items.map((i) => i.id)).toEqual([bug.id]);
    expect(
      (await call({ method: 'GET', path: '/items?tabId=t2', owner: 'v', code: 'TAB1' })).status,
    ).toBe(404);
    expect(
      (
        await call({
          path: `/items/${task.id}?tabId=t1`,
          owner: 'v',
          code: 'TAB1',
          body: { set: { title: 'x' } },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call({
          path: `/items/${bug.id}?tabId=t1`,
          owner: 'v',
          code: 'TAB1',
          body: { set: { title: 'y' } },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call({
          method: 'DELETE',
          path: `/items/${task.id}?tabId=t1`,
          owner: 'v',
          code: 'TAB1',
        })
      ).status,
    ).toBe(404);
  });

  it('answers 405 for a wrong method', async () => {
    expect((await call({ method: 'PUT', path: '/items' })).status).toBe(405);
    expect((await call({ method: 'GET', path: '/items/bulk' })).status).toBe(405);
    expect((await call({ method: 'GET', path: '/items/x/move' })).status).toBe(405);
    expect((await call({ method: 'PUT', path: '/items/abcdef12' })).status).toBe(405);
  });
});

describe('documents and items', () => {
  it('seeds items on a genuine create only, refusing bad ones before writing', async () => {
    // POST /api/documents is the collection route.
    const ctx = (id: string, items: unknown) =>
      handleDocuments(
        makeTestRouteContext('POST', '/api/documents', {
          env: sql.env,
          owner: 'owner',
          body: { id, name: 'New', items },
        }),
      );
    expect((await ctx('d2', [{ type: 'task', fields: {} }])).status).toBe(400);
    expect(await db.getDocument(sql.env, 'd2')).toBeNull();
    expect(
      (await ctx('d2', [{ type: 'task', fields: { title: 'Seed', status: 'todo' } }])).status,
    ).toBe(201);
    expect((await db.listItems(sql.env, 'd2')).map((i) => i.fields['title'])).toEqual(['Seed']);
    expect((await ctx('d2', [{ type: 'task', fields: { title: 'Again' } }])).status).toBe(201);
    expect(await db.listItems(sql.env, 'd2')).toHaveLength(1);
  });

  it('copies items with a document and cascades them on delete', async () => {
    await add({ title: 'A' });
    await call({
      path: '/items',
      body: { type: 'task', fields: { title: 'B', status: 'new', labels: ['bug'] } },
    });
    await db.copyDocument(sql.env, 'd1', 'd3', 'owner', 'Copy');
    const copied = await db.listItems(sql.env, 'd3');
    expect(copied.map((i) => i.key).sort()).toEqual([1, 2]);
    expect((await db.getItemStoreHead(sql.env, 'd3')).nextKey).toBe(3);
    await db.copyDocument(sql.env, 'd1', 'd4', 'owner', 'Tab copy', 't1');
    // The tab has a board, so it shows (and its copy takes) every item.
    expect((await db.listItems(sql.env, 'd4')).map((i) => i.fields['title']).sort()).toEqual([
      'A',
      'B',
    ]);
    sql.sql.exec("DELETE FROM documents WHERE id = 'd1'");
    expect(await db.listItems(sql.env, 'd1')).toEqual([]);
  });
});

// docs/specs/026-plan/item-types.md "An item type": the Default State, for a card created without a status.
describe('a type’s Default State', () => {
  const withDefault = (extra: Record<string, unknown>) => ({
    version: 1,
    types: [
      {
        id: 'task',
        label: 'Task',
        color: '#71717a',
        glyph: 'task',
        fields: ['description'],
        ...extra,
      },
    ],
  });

  it('gives a card made without a status its type’s Default State, never overriding a given one', async () => {
    await call({
      method: 'PUT',
      path: '/item-types',
      body: { itemTypes: withDefault({ defaultStatus: 'backlog' }) },
    });
    expect((await add({ title: 'A' })).body.item.fields['status']).toBe('backlog');
    expect((await add({ title: 'B', status: 'done' })).body.item.fields['status']).toBe('done');
    expect(
      (await add({ title: 'C' }, { place: { status: 'doing' } })).body.item.fields['status'],
    ).toBe('doing');
  });

  it('leaves a card unplaced when the type turns its Default State off', async () => {
    await call({
      method: 'PUT',
      path: '/item-types',
      body: { itemTypes: withDefault({ defaultStatus: 'backlog', excludedStatuses: ['backlog'] }) },
    });
    expect((await add({ title: 'A' })).body.item.fields['status']).toBeUndefined();
  });
});

// docs/specs/026-plan/item-types.md "An item type": a type's left-out statuses refuse a card moving in.
describe('statuses a type leaves out', () => {
  const noDone = {
    version: 1,
    types: [
      {
        id: 'task',
        label: 'Task',
        color: '#71717a',
        glyph: 'task',
        fields: ['description'],
        excludedStatuses: ['done'],
      },
    ],
  };

  it('refuses a move or a patch into one, for that type only, but never a make', async () => {
    const put = await call({ method: 'PUT', path: '/item-types', body: { itemTypes: noDone } });
    expect(put.status).toBe(200);
    const t = (await add({ title: 'T', status: 'todo' })).body.item;
    const moved = await call({ path: `/items/${t.id}/move`, body: { status: 'done' } });
    expect(moved.status).toBe(400);
    expect(moved.body).toEqual({ error: 'status_excluded', field: 'status' });
    const patched = await call({
      path: `/items/${t.id}`,
      body: { set: { status: 'done' } },
    });
    expect(patched.body).toMatchObject({ error: 'status_excluded' });
    // Made straight into it: allowed (it is only never moved there).
    expect((await add({ title: 'U', status: 'done' })).status).toBe(201);
    // Another type may still be Done.
    expect((await add({ title: 'N', status: 'done' }, { type: 'note' })).status).toBe(201);
  });

  it('lets a card already in one stay, be reordered there, and move out', async () => {
    await call({ method: 'PUT', path: '/item-types', body: { itemTypes: noDone } });
    const a = (await add({ title: 'A', status: 'done' })).body.item;
    const b = (await add({ title: 'B', status: 'done' })).body.item;
    expect((await call({ path: `/items/${b.id}/move`, body: { before: a.id } })).status).toBe(200);
    expect((await call({ path: `/items/${a.id}/move`, body: { status: 'todo' } })).status).toBe(
      200,
    );
  });

  it('restores a trashed card to the status it was trashed from, even a left-out one', async () => {
    await call({ method: 'PUT', path: '/item-types', body: { itemTypes: noDone } });
    const t = (await add({ title: 'T', status: 'done' })).body.item;
    const trashed = await call({
      path: `/items/${t.id}`,
      body: { set: { status: 'trash', trashedFrom: 'done' } },
    });
    expect(trashed.status).toBe(200);
    const restored = await call<{ item: { fields: Record<string, unknown> } }>({
      path: `/items/${t.id}`,
      body: { set: { status: 'done' }, clear: ['trashedFrom'] },
    });
    expect(restored.status).toBe(200);
    expect(restored.body.item.fields['status']).toBe('done');
    // Out of the Trash into another left-out status than the one it came from: still refused.
    const other = (await add({ title: 'O', status: 'todo' })).body.item;
    await call({
      path: `/items/${other.id}`,
      body: { set: { status: 'trash', trashedFrom: 'todo' } },
    });
    const sneaked = await call({ path: `/items/${other.id}`, body: { set: { status: 'done' } } });
    expect(sneaked.body).toMatchObject({ error: 'status_excluded' });
  });

  it('lets an undo or redo put a card back into one', async () => {
    await call({ method: 'PUT', path: '/item-types', body: { itemTypes: noDone } });
    const t = (await add({ title: 'T', status: 'done' })).body.item;
    expect((await call({ path: `/items/${t.id}/move`, body: { status: 'todo' } })).status).toBe(
      200,
    );
    // The undo of that move, and the same as a patch: let through.
    const undone = await call<{ item: { fields: Record<string, unknown> } }>({
      path: `/items/${t.id}/move`,
      body: { status: 'done', undo: true },
    });
    expect(undone.status).toBe(200);
    expect(undone.body.item.fields['status']).toBe('done');
    await call({ path: `/items/${t.id}/move`, body: { status: 'todo' } });
    expect(
      (await call({ path: `/items/${t.id}`, body: { set: { status: 'done' }, undo: true } }))
        .status,
    ).toBe(200);
    // Without the flag the same move is refused.
    await call({ path: `/items/${t.id}/move`, body: { status: 'todo' } });
    const plain = await call({ path: `/items/${t.id}/move`, body: { status: 'done' } });
    expect(plain.body).toMatchObject({ error: 'status_excluded' });
  });
});

// docs/specs/026-plan/item-types.md "Storage and sync".
describe('the type catalogue', () => {
  const catalogue = {
    version: 1,
    types: [
      {
        id: 'customer-call',
        label: 'Customer call',
        color: '#0891b2',
        glyph: 'chat',
        fields: ['description', 'f-outcome'],
        custom: [{ id: 'f-outcome', label: 'Outcome', kind: 'choice', options: ['Won', 'Lost'] }],
      },
    ],
  };
  const put = (itemTypes: unknown, extra: Partial<Call> = {}) =>
    call<{ itemTypes: unknown }>({
      method: 'PUT',
      path: '/item-types',
      body: { itemTypes },
      ...extra,
    });

  it('stores a catalogue normalised, relays it, and the document carries it', async () => {
    const res = await put(catalogue);
    expect(res.status).toBe(200);
    const stored = (res.body.itemTypes as { types: { fields: string[]; newTitle: string }[] })
      .types[0]!;
    expect(stored.fields).toEqual(['title', 'status', 'description', 'f-outcome']);
    expect(stored.newTitle).toBe('New customer call');
    expect(relayed).toEqual([
      { op: { kind: 'item-types', itemTypes: res.body.itemTypes }, ordered: true },
    ]);
    expect((await db.getDocument(sql.env, 'd1'))?.itemTypes).toEqual(res.body.itemTypes);
  });

  it('goes back to the built-in types on null', async () => {
    await put(catalogue);
    expect((await put(null)).body).toEqual({ itemTypes: null });
    expect((await db.getDocument(sql.env, 'd1'))?.itemTypes).toBeNull();
  });

  it('refuses a catalogue by name and keeps the last good one', async () => {
    await put(catalogue);
    const bad = await put({ ...catalogue, types: [{ ...catalogue.types[0], glyph: 'unicorn' }] });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'item_types_invalid', reason: 'types[0].glyph' });
    expect((await put(undefined)).status).toBe(400);
    expect((await db.getDocument(sql.env, 'd1'))?.itemTypes?.types[0]?.id).toBe('customer-call');
  });

  it('needs edit access to the whole document', async () => {
    expect((await put(catalogue, { owner: 'v', code: 'VIEW' })).status).toBe(403);
    expect((await put(catalogue, { owner: 'v', code: 'TAB1' })).status).toBe(403);
    expect((await put(catalogue, { owner: 'v', code: 'EDIT' })).status).toBe(200);
    expect((await call({ method: 'GET', path: '/item-types' })).status).toBe(405);
  });

  it('travels with a copy', async () => {
    await put(catalogue);
    await db.copyDocument(sql.env, 'd1', 'd5', 'owner', 'Copy');
    expect((await db.getDocument(sql.env, 'd5'))?.itemTypes?.types[0]?.id).toBe('customer-call');
  });
});

describe('a create carrying a type catalogue', () => {
  const create = (itemTypes: unknown) =>
    makeTestRouteContext('POST', '/api/documents', {
      env: sql.env,
      owner: 'owner',
      body: { id: 'd9', name: 'Synced', tabs: [], itemTypes },
    });
  const types = {
    version: 1,
    types: [{ id: 'risk', label: 'Risk', color: '#ea580c', glyph: 'risk', fields: [] }],
  };

  it('keeps a valid one and refuses a bad one by name', async () => {
    expect((await handleDocuments(create({ ...types, version: 9 }))).status).toBe(400);
    expect((await handleDocuments(create(types))).status).toBeLessThan(300);
    expect((await db.getDocument(sql.env, 'd9'))?.itemTypes?.types[0]?.fields).toEqual([
      'title',
      'status',
    ]);
  });
});
