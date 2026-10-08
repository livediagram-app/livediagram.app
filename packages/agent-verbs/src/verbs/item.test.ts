import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { fieldsFromPairs, itemAdd, itemLs, itemMove, itemRm, itemSet } from './item';

// The item verbs (docs/specs/026-plan/plan-mode.md "Agents"; docs/specs/015-api/cli.md "Commands").
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const item = (key: number, id: string, fields: Item['fields'], type = 'task'): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const ITEMS = [
  item(2, 'itemaaa222', { title: 'Docs', status: 'todo' }),
  item(1, 'itembbb111', { title: 'Fix login', status: 'doing', priority: 'high' }, 'bug'),
];
const path = `/documents/${DOC_A}/items`;
const BUG = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  custom: [{ id: 'f-severity', label: 'Severity', kind: 'text' }],
};
const PLAN = {
  boards: [
    {
      tabId: 't1',
      tabName: 'Board',
      elementId: 'b1',
      title: 'Sprint',
      kind: 'board',
      types: null,
      columns: [
        { status: 'todo', name: 'To Do' },
        { status: 'doing', name: 'Doing' },
        { status: 'done', name: 'Done' },
      ],
    },
  ],
  statuses: [
    { status: 'todo', name: 'To Do' },
    { status: 'doing', name: 'Doing' },
    { status: 'done', name: 'Done' },
  ],
  types: [...ITEM_TYPES, BUG],
};

function api(extra: Record<string, unknown> = {}) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const echo = async (request: Request) => {
    const url = new URL(request.url);
    const text = await request.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    seen.push({ method: request.method, path: url.pathname.replace(/^\/api/, ''), body });
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ item: item(3, 'itemccc333', { title: 'New', status: 'todo' }), rev: 9 });
  };
  const fake = fakeApi({
    ...library,
    ...tabsOfA,
    [path]: (r: Request) =>
      r.method === 'GET' ? Response.json({ items: ITEMS, rev: 4 }) : echo(r),
    [`/documents/${DOC_A}/plan`]: PLAN,
    [`${path}/itembbb111`]: echo,
    [`${path}/itembbb111/move`]: echo,
    ...extra,
  });
  return { ctx: contextOf(fake), seen };
}

describe('item ls', () => {
  it('lists by number, narrowed by type and status', async () => {
    const { ctx } = api();
    const all = await itemLs.run!(ctx, { doc: DOC_A, type: undefined, status: undefined });
    expect(itemLs.text!(all)).toEqual([
      'Sprint: To Do 1 · Doing 1 · Done 0',
      '#1  bug   Doing  "Fix login"',
      '#2  task  To Do  "Docs"',
    ]);
    const bugs = await itemLs.run!(ctx, { doc: DOC_A, type: 'bug', status: undefined });
    expect(itemLs.quiet!(bugs)).toEqual(['#1']);
    expect(
      (await itemLs.run!(ctx, { doc: DOC_A, type: undefined, status: 'todo' })).items,
    ).toHaveLength(1);
    expect(
      (await itemLs.run!(ctx, { doc: DOC_A, type: 'Bug', status: 'to do' })).items,
    ).toHaveLength(0);
  });
});

describe('item writes', () => {
  it('adds with fields from key=value pairs', async () => {
    const { ctx, seen } = api();
    const out = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({
        doc: DOC_A,
        title: 'New',
        status: 'To Do',
        fields: ['priority=high', 'labels=ux, api', 'estimate=3'],
      }),
    );
    expect(out.text).toBe('+ #3 [task] New');
    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: {
        type: 'task',
        fields: { priority: 'high', labels: ['ux', 'api'], estimate: 3, title: 'New' },
        place: { status: 'todo' },
      },
    });
  });

  it('sets, moves and removes an item named by its number', async () => {
    const { ctx, seen } = api();
    await itemSet.run!(
      ctx,
      itemSet.input.parse({
        doc: DOC_A,
        item: '#1',
        fields: ['priority=urgent'],
        clear: ['Due Date'],
        type: 'Bug',
      }),
    );
    expect(seen[0]).toMatchObject({
      path: `${path}/itembbb111`,
      body: { set: { priority: 'urgent' }, clear: ['due'], type: 'bug' },
    });
    await itemMove.run!(ctx, { doc: DOC_A, item: '1', status: 'to-do', before: '#2' });
    expect(seen[1]).toMatchObject({
      path: `${path}/itembbb111/move`,
      body: { status: 'todo', before: 'itemaaa222' },
    });
    const rm = await itemRm.run!(ctx, { doc: DOC_A, item: 'itembbb' });
    expect(rm.text).toBe('- #1 [bug] Fix login (!high)');
    expect(seen[2]).toMatchObject({ method: 'DELETE' });
  });

  it('refuses an item it cannot name, and a field without a value', async () => {
    const { ctx } = api();
    await expect(itemRm.run!(ctx, { doc: DOC_A, item: '#9' })).rejects.toBeInstanceOf(VerbRefusal);
    expect(() => fieldsFromPairs(['priority'])).toThrow(VerbRefusal);
  });
});

describe('item output and refusals', () => {
  it('prints each write as a line, and its number when quiet', async () => {
    const { ctx, seen } = api();
    const added = await itemAdd.run!(ctx, itemAdd.input.parse({ doc: DOC_A, title: 'New' }));
    expect(seen[0]!.body).toEqual({ type: 'task', fields: { title: 'New' } });
    expect(itemAdd.text!(added)).toEqual(['+ #3 [task] New']);
    expect(itemAdd.quiet!(added)).toEqual(['#3']);
    const set = await itemSet.run!(
      ctx,
      itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['estimate=a lot'] }),
    );
    expect(seen[1]!.body).toEqual({ set: { estimate: 'a lot' } });
    expect(itemSet.text!(set)).toEqual(['~ #3 [task] New']);
    expect(itemSet.quiet!(set)).toEqual(['#3']);
    const moved = await itemMove.run!(ctx, {
      doc: DOC_A,
      item: '#1',
      status: 'done',
      before: undefined,
    });
    expect(seen[2]!.body).toEqual({ status: 'done', before: null });
    expect(itemMove.text!(moved)).toEqual(['→ #3 [task] New in done']);
    expect(itemMove.quiet!(moved)).toEqual(['#3']);
    const rm = await itemRm.run!(ctx, { doc: DOC_A, item: '#1' });
    expect(itemRm.text!(rm)).toEqual(['- #1 [bug] Fix login (!high)']);
    expect(itemRm.quiet!(rm)).toEqual(['itembbb111']);
  });

  it('lists the items a name could mean', async () => {
    const { ctx } = api();
    const refusal = await itemRm.run!(ctx, { doc: DOC_A, item: 'item' }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(VerbRefusal);
    expect((refusal as VerbRefusal).code).toBe('item_unknown');
    expect((refusal as VerbRefusal).message).toMatch(/more than one item/);
  });

  it("names the api's refusal, and passes any other failure on", async () => {
    const refusing = (status: number) =>
      api({
        [`${path}/itembbb111`]: () => Response.json({ error: 'invalid_fields' }, { status }),
      }).ctx;
    const refusal = await itemSet.run!(
      refusing(400),
      itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['priority=high'] }),
    ).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(VerbRefusal);
    await expect(
      itemSet.run!(
        refusing(500),
        itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['priority=high'] }),
      ),
    ).rejects.not.toBeInstanceOf(VerbRefusal);
    await expect(itemRm.run!(refusing(500), { doc: DOC_A, item: '#1' })).rejects.toThrow();
  });
});

describe('item edges', () => {
  it('shows an item with no status as a dash', async () => {
    const { ctx } = api({
      [path]: () => Response.json({ items: [item(5, 'itemddd555', { title: 'Loose' })], rev: 1 }),
    });
    const out = await itemLs.run!(ctx, { doc: DOC_A, type: undefined, status: undefined });
    expect(out.items[0]!.status).toBeNull();
    expect(itemLs.text!(out)).toEqual([
      'Sprint: To Do 0 · Doing 0 · Done 0',
      '#5  task  -  "Loose"',
    ]);
  });

  it('calls a refusal with no code invalid', async () => {
    const { ctx } = api({
      [`${path}/itembbb111`]: () => new Response('', { status: 400 }),
    });
    const refusal = await itemSet.run!(
      ctx,
      itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['priority=high'] }),
    ).catch((e: unknown) => e);
    expect((refusal as VerbRefusal).code).toBe('http_400');
  });

  it('says plainly when the card type does not use the status', async () => {
    const { ctx } = api({
      [`${path}/itembbb111/move`]: () =>
        Response.json({ error: 'status_excluded', field: 'status' }, { status: 400 }),
    });
    const refusal = await itemMove.run!(ctx, {
      doc: DOC_A,
      item: '#1',
      status: 'done',
      before: undefined,
    }).catch((e: unknown) => e);
    expect((refusal as VerbRefusal).code).toBe('status_excluded');
    expect((refusal as VerbRefusal).message).toMatch(/card type does not use that column/);
  });
});

describe('item names (docs/specs/026-plan/plan-agents.md)', () => {
  it('refuses a column, type or field the document lacks, listing what is there', async () => {
    const { ctx, seen } = api();
    const column = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ doc: DOC_A, title: 'x', status: 'Review' }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(column).toMatchObject({ code: 'status_unknown' });
    expect((column as VerbRefusal).message).toContain('Columns: To Do, Doing, Done');
    const type = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ doc: DOC_A, title: 'x', type: 'Epic' }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(type).toMatchObject({ code: 'type_unknown' });
    const field = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ doc: DOC_A, title: 'x', type: 'bug', fields: ['Effort=3'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(field).toMatchObject({ code: 'field_unknown' });
    expect(seen).toEqual([]);
  });

  it('sets a custom field and an assignee by name', async () => {
    const { ctx, seen } = api();
    await itemAdd.run!(
      ctx,
      itemAdd.input.parse({
        doc: DOC_A,
        title: 'Crash',
        type: 'Bug',
        fields: ['severity=S2', 'assignee=Sam'],
      }),
    );
    expect(seen[0]!.body).toMatchObject({
      type: 'bug',
      fields: { 'f-severity': 'S2', assignee: { id: 'n-sam', name: 'Sam' }, title: 'Crash' },
    });
  });
});

describe('item edges after names', () => {
  it('prints a write whose item has no status, the no-board hint, and a refused delete', async () => {
    const { ctx } = api({
      [path]: (r: Request) =>
        r.method === 'GET'
          ? Response.json({ items: ITEMS, rev: 4 })
          : Response.json({ item: item(7, 'itemfff777', { title: 'Loose' }), rev: 5 }),
    });
    const out = await itemAdd.run!(ctx, itemAdd.input.parse({ doc: DOC_A, title: 'Loose' }));
    expect(out.item.status).toBeNull();
    const bare = api({
      [`/documents/${DOC_A}/plan`]: { boards: [], statuses: [], types: ITEM_TYPES },
    }).ctx;
    const ls = await itemLs.run!(bare, { doc: DOC_A, type: undefined, status: undefined });
    expect(itemLs.text!(ls)[0]).toContain('no Plan board yet');
    const refusing = api({
      [`${path}/itembbb111`]: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    }).ctx;
    await expect(itemRm.run!(refusing, { doc: DOC_A, item: '#1' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});
