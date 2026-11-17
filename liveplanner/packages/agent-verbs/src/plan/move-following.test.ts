import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item, type ItemFields, type ItemTypeDef } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { applyItemChanges } from './item-changes';
import { itemLister } from './plan-listing';
import { readPlanState } from './plan-state';

// docs/specs/026-plan/plan-views.md "Dependency clashes", "Moving the cards that follow"; item-types.md "Blocked By"
// (Agents): list_items lists a card's clashes, and change_items' set takes moveFollowing.

const D = 'doc1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, 'f-bb'],
  custom: [
    ...(BASE.custom ?? []),
    {
      id: 'f-bb',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'task',
      multiple: true,
      blocks: true,
    },
  ],
};
const make = (id: string, key: number, fields: ItemFields): Item => ({
  id,
  type: 'task',
  key,
  rank: 'k',
  fields: { status: 'todo~x', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const design = make('aaa111', 1, { title: 'Design', start: '2026-03-02', due: '2026-03-06' });
const build = make('bbb222', 2, {
  title: 'Build',
  start: '2026-03-09',
  due: '2026-03-11',
  'f-bb': ['aaa111'],
});
const ship = make('ccc333', 3, {
  title: 'Ship',
  start: '2026-03-12',
  due: '2026-03-12',
  'f-bb': ['bbb222'],
});
const plan = {
  boards: [
    {
      id: 'b',
      kind: 'board',
      title: 'Board',
      columns: [
        { status: 'todo~x', name: 'To Do' },
        { status: 'done~x', name: 'Done', done: true },
      ],
    },
  ],
  statuses: [
    { status: 'todo~x', name: 'To Do' },
    { status: 'done~x', name: 'Done' },
  ],
  types: [...ITEM_TYPES.filter((t) => t.id !== 'task'), TASK],
};

// Each write answers the card with its fields set, and is kept in `writes`.
function api(items: Item[]) {
  const writes: { id: string; set: ItemFields }[] = [];
  const write = (it: Item) => async (r: Request) => {
    const body = (await r.json()) as { set: ItemFields };
    writes.push({ id: it.id, set: body.set });
    return Response.json({ item: { ...it, fields: { ...it.fields, ...body.set } } });
  };
  return {
    writes,
    api: fakeApi({
      [`/projects/${D}/items`]: { items, rev: 1 },
      [`/projects/${D}/plan`]: plan,
      ...Object.fromEntries(items.map((it) => [`/projects/${D}/items/${it.id}`, write(it)])),
    }),
  };
}

describe('agents and dependency clashes', () => {
  it('lists a card’s clashes with its open blockers', async () => {
    const early = { ...build, fields: { ...build.fields, start: '2026-03-04' } };
    const { api: a } = api([design, early, ship]);
    const lister = itemLister(await readPlanState(a, D));
    expect(lister(early).clashes).toEqual(['Starts 2 days before #1 Design is due']);
    expect(lister(design).clashes).toBeUndefined();
    expect(lister(ship).clashes).toBeUndefined();
  });

  it('moves the cards that follow a date change, a line each, only when asked', async () => {
    const { api: a, writes } = api([design, build, ship]);
    const state = await readPlanState(a, D);
    const r = await applyItemChanges(
      a,
      D,
      [{ op: 'set', item: '#1', fields: { due: '2026-03-10' }, moveFollowing: true }],
      state,
    );
    expect(r.refusal).toBeUndefined();
    expect(writes.map((w) => [w.id, w.set])).toEqual([
      ['aaa111', { due: '2026-03-10' }],
      ['bbb222', { start: '2026-03-11', due: '2026-03-13' }],
      ['ccc333', { start: '2026-03-14', due: '2026-03-14' }],
    ]);
    expect(r.applied.slice(1)).toEqual([
      expect.stringMatching(/^~ #2 .*Build.*; moved 2 days later, after #1 Design$/),
      expect.stringMatching(/^~ #3 .*Ship.*; moved 2 days later, after #1 Design$/),
    ]);

    const { api: b, writes: alone } = api([design, build, ship]);
    await applyItemChanges(
      b,
      D,
      [{ op: 'set', item: '#1', fields: { due: '2026-03-10' } }],
      await readPlanState(b, D),
    );
    expect(alone).toHaveLength(1);
  });

  it('says a one-day move as one day', async () => {
    const { api: a } = api([design, build, ship]);
    const r = await applyItemChanges(
      a,
      D,
      [{ op: 'set', item: '#1', fields: { due: '2026-03-09' }, moveFollowing: true }],
      await readPlanState(a, D),
    );
    expect(r.applied[1]).toMatch(/; moved 1 day later, after #1 Design$/);
  });

  it('stops where the api refuses a card it may not change, saying what moved', async () => {
    const { api: a } = api([design, build, ship]);
    const state = await readPlanState(a, D);
    const refusing = fakeApi({
      [`/projects/${D}/items/aaa111`]: () =>
        Response.json({ item: { ...design, fields: { ...design.fields, due: '2026-03-10' } } }),
      [`/projects/${D}/items/bbb222`]: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    const r = await applyItemChanges(
      refusing,
      D,
      [{ op: 'set', item: '#1', fields: { due: '2026-03-10' }, moveFollowing: true }],
      state,
    );
    expect(r.applied).toHaveLength(1);
    expect(r.refusal).toBeDefined();
  });
});
