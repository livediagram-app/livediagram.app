import { describe, expect, it } from 'vitest';
import type { Item } from '@livediagram/items';
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
    expect(itemLs.text!(all)).toEqual(['#1  bug   doing  "Fix login"', '#2  task  todo   "Docs"']);
    const bugs = await itemLs.run!(ctx, { doc: DOC_A, type: 'bug', status: undefined });
    expect(itemLs.quiet!(bugs)).toEqual(['#1']);
    expect(
      (await itemLs.run!(ctx, { doc: DOC_A, type: undefined, status: 'todo' })).items,
    ).toHaveLength(1);
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
        status: 'todo',
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
        clear: ['due'],
        type: 'story',
      }),
    );
    expect(seen[0]).toMatchObject({
      path: `${path}/itembbb111`,
      body: { set: { priority: 'urgent' }, clear: ['due'], type: 'story' },
    });
    await itemMove.run!(ctx, { doc: DOC_A, item: '1', status: 'todo', before: '#2' });
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
    expect((refusal as VerbRefusal).code).toBe('ambiguous');
  });

  it("names the api's refusal, and passes any other failure on", async () => {
    const refusing = (status: number) =>
      api({
        [`${path}/itembbb111`]: () => Response.json({ error: 'invalid_fields' }, { status }),
      }).ctx;
    const refusal = await itemSet.run!(
      refusing(400),
      itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['a=b'] }),
    ).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(VerbRefusal);
    await expect(
      itemSet.run!(refusing(500), itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['a=b'] })),
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
    expect(itemLs.text!(out)).toEqual(['#5  task  -  "Loose"']);
  });

  it('calls a refusal with no code invalid', async () => {
    const { ctx } = api({
      [`${path}/itembbb111`]: () => new Response('', { status: 400 }),
    });
    const refusal = await itemSet.run!(
      ctx,
      itemSet.input.parse({ doc: DOC_A, item: '#1', fields: ['a=b'] }),
    ).catch((e: unknown) => e);
    expect((refusal as VerbRefusal).code).toBe('invalid');
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
    expect((refusal as VerbRefusal).message).toMatch(/card type does not use that status/);
  });
});
