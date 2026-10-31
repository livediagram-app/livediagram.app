import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { listedType } from '../plan/plan-listing';
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
const path = `/projects/${DOC_A}/items`;
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
        { status: 'done', name: 'Done', done: true },
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
    [`/projects/${DOC_A}/plan`]: PLAN,
    [`${path}/itembbb111`]: echo,
    [`${path}/itembbb111/move`]: echo,
    ...extra,
  });
  return { ctx: contextOf(fake), seen };
}

describe('item ls', () => {
  it('lists by number, narrowed by type and status', async () => {
    const { ctx } = api();
    const all = await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: undefined });
    expect(itemLs.text!(all)).toEqual([
      'Sprint: To Do 1 · Doing 1 · Done ✓ 0',
      '#1  bug   Doing  "Fix login"',
      '#2  task  To Do  "Docs"',
    ]);
    const bugs = await itemLs.run!(ctx, { project: DOC_A, type: 'bug', status: undefined });
    expect(itemLs.quiet!(bugs)).toEqual(['#1']);
    expect(
      (await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: 'todo' })).items,
    ).toHaveLength(1);
    expect(
      (await itemLs.run!(ctx, { project: DOC_A, type: 'Bug', status: 'to do' })).items,
    ).toHaveLength(0);
    // Named as item add and set name a column: in-progress style spelling reads the same column.
    expect(
      (await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: 'TO-DO' })).items,
    ).toHaveLength(1);
    await expect(
      itemLs.run!(ctx, { project: DOC_A, type: undefined, status: 'Review' }),
    ).rejects.toMatchObject({ code: 'status_unknown' });
  });
});

describe('item writes', () => {
  it('adds with fields from key=value pairs', async () => {
    const { ctx, seen } = api();
    const out = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({
        project: DOC_A,
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
        project: DOC_A,
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
    await itemMove.run!(ctx, { project: DOC_A, item: '1', status: 'to-do', before: '#2' });
    expect(seen[1]).toMatchObject({
      path: `${path}/itembbb111/move`,
      body: { status: 'todo', before: 'itemaaa222' },
    });
    const rm = await itemRm.run!(ctx, { project: DOC_A, item: 'itembbb' });
    expect(rm.text).toBe('- #1 [bug] Fix login (!high)');
    expect(seen[2]).toMatchObject({ method: 'DELETE' });
  });

  it('refuses an item it cannot name, and a field without a value', async () => {
    const { ctx } = api();
    // A value the field cannot hold is refused before anything is sent, saying what it takes.
    await expect(
      itemSet.run!(
        ctx,
        itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['estimate=a lot'] }),
      ),
    ).rejects.toThrow('"a lot" is not an Estimate: give a number from 0 to 999.');
    await expect(itemRm.run!(ctx, { project: DOC_A, item: '#9' })).rejects.toBeInstanceOf(
      VerbRefusal,
    );
    expect(() => fieldsFromPairs(['priority'])).toThrow(VerbRefusal);
  });
});

describe('item output and refusals', () => {
  it('prints each write as a line, and its number when quiet', async () => {
    const { ctx, seen } = api();
    const added = await itemAdd.run!(ctx, itemAdd.input.parse({ project: DOC_A, title: 'New' }));
    expect(seen[0]!.body).toEqual({ type: 'task', fields: { title: 'New' } });
    expect(itemAdd.text!(added)).toEqual(['+ #3 [task] New']);
    expect(itemAdd.quiet!(added)).toEqual(['#3']);
    const set = await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['estimate=3'] }),
    );
    expect(seen[1]!.body).toEqual({ set: { estimate: 3 } });
    expect(itemSet.text!(set)).toEqual(['~ #3 [task] New']);
    expect(itemSet.quiet!(set)).toEqual(['#3']);
    const moved = await itemMove.run!(ctx, {
      project: DOC_A,
      item: '#1',
      status: 'done',
      before: undefined,
    });
    expect(seen[2]!.body).toEqual({ status: 'done', before: null });
    expect(itemMove.text!(moved)).toEqual(['→ #3 [task] New in done']);
    expect(itemMove.quiet!(moved)).toEqual(['#3']);
    const rm = await itemRm.run!(ctx, { project: DOC_A, item: '#1' });
    expect(itemRm.text!(rm)).toEqual(['- #1 [bug] Fix login (!high)']);
    expect(itemRm.quiet!(rm)).toEqual(['itembbb111']);
  });

  it('lists the items a name could mean', async () => {
    const { ctx } = api();
    const refusal = await itemRm.run!(ctx, { project: DOC_A, item: 'item' }).catch(
      (e: unknown) => e,
    );
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
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['priority=high'] }),
    ).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(VerbRefusal);
    await expect(
      itemSet.run!(
        refusing(500),
        itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['priority=high'] }),
      ),
    ).rejects.not.toBeInstanceOf(VerbRefusal);
    await expect(itemRm.run!(refusing(500), { project: DOC_A, item: '#1' })).rejects.toThrow();
  });
});

describe('item edges', () => {
  it('shows an item with no status as a dash', async () => {
    const { ctx } = api({
      [path]: () => Response.json({ items: [item(5, 'itemddd555', { title: 'Loose' })], rev: 1 }),
    });
    const out = await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: undefined });
    expect(out.items[0]!.status).toBeNull();
    expect(itemLs.text!(out)).toEqual([
      'Sprint: To Do 0 · Doing 0 · Done ✓ 0',
      '#5  task  -  "Loose"',
    ]);
  });

  it('calls a refusal with no code invalid', async () => {
    const { ctx } = api({
      [`${path}/itembbb111`]: () => new Response('', { status: 400 }),
    });
    const refusal = await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['priority=high'] }),
    ).catch((e: unknown) => e);
    expect((refusal as VerbRefusal).code).toBe('http_400');
  });

  it('says plainly when the card type does not use the status', async () => {
    const { ctx } = api({
      [`${path}/itembbb111/move`]: () =>
        Response.json({ error: 'status_excluded', field: 'status' }, { status: 400 }),
    });
    const refusal = await itemMove.run!(ctx, {
      project: DOC_A,
      item: '#1',
      status: 'done',
      before: undefined,
    }).catch((e: unknown) => e);
    expect((refusal as VerbRefusal).code).toBe('status_excluded');
    expect((refusal as VerbRefusal).message).toMatch(/card type does not use that column/);
  });
});

describe('item names (docs/specs/026-plan/plan-agents.md)', () => {
  it('refuses a column, type or field the project lacks, listing what is there', async () => {
    const { ctx, seen } = api();
    const column = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'x', status: 'Review' }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(column).toMatchObject({ code: 'status_unknown' });
    expect((column as VerbRefusal).message).toContain('Columns: To Do, Doing, Done');
    const type = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'x', type: 'Epic' }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(type).toMatchObject({ code: 'type_unknown' });
    const field = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'x', type: 'bug', fields: ['Effort=3'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(field).toMatchObject({ code: 'field_unknown' });
    expect(seen).toEqual([]);
  });

  it('sets a custom field and an assignee by name', async () => {
    const { ctx, seen } = api();
    await itemAdd.run!(
      ctx,
      itemAdd.input.parse({
        project: DOC_A,
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
    const out = await itemAdd.run!(ctx, itemAdd.input.parse({ project: DOC_A, title: 'Loose' }));
    expect(out.item.status).toBeNull();
    const bare = api({
      [`/projects/${DOC_A}/plan`]: { boards: [], statuses: [], types: ITEM_TYPES },
    }).ctx;
    const ls = await itemLs.run!(bare, { project: DOC_A, type: undefined, status: undefined });
    expect(itemLs.text!(ls)[0]).toContain('no board yet');
    const refusing = api({
      [`${path}/itembbb111`]: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    }).ctx;
    await expect(itemRm.run!(refusing, { project: DOC_A, item: '#1' })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

// docs/specs/026-plan/item-types.md "Calculated fields".
describe('calculated fields', () => {
  const EPIC = {
    ...ITEM_TYPES[0],
    id: 'epic',
    label: 'Epic',
    fields: ['title', 'status', 'f-kids', 'f-done'],
    custom: [
      { id: 'f-kids', label: 'Stories', kind: 'calculated', calculation: 'childCount' },
      { id: 'f-done', label: 'Progress', kind: 'calculated', calculation: 'childrenDone' },
    ],
  };
  const STORY = {
    ...ITEM_TYPES[1],
    id: 'story',
    label: 'Story',
    fields: ['title', 'status', 'f-epic'],
    custom: [{ id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'epic' }],
  };
  const items = [
    item(1, 'itemepic01', { title: 'Checkout', status: 'doing' }, 'epic'),
    item(2, 'itemstory1', { title: 'Pay', status: 'done', 'f-epic': 'itemepic01' }, 'story'),
    item(3, 'itemstory2', { title: 'Ship', status: 'todo', 'f-epic': 'itemepic01' }, 'story'),
    item(4, 'itemstory3', { title: 'Old', status: 'done', 'f-epic': 'itemepic01' }, 'story'),
    item(5, 'itemstory4', { title: 'Gone', status: 'trash', 'f-epic': 'itemepic01' }, 'story'),
  ];
  const withCalc = () =>
    api({
      [`/projects/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, EPIC, STORY] },
      [path]: (r: Request) =>
        r.method === 'GET'
          ? Response.json({ items, rev: 4 })
          : Response.json({ item: items[0], rev: 5 }),
    });

  it('lists each card’s values by name, and the fields as read-only', async () => {
    const { ctx } = withCalc();
    const out = await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: undefined });
    const epic = out.items.find((i) => i.id === 'itemepic01')!;
    expect(epic.fields).toMatchObject({ Stories: 3, Progress: 67 });
    const story = out.items.find((i) => i.id === 'itemstory2')!;
    expect(story.fields).not.toHaveProperty('Stories');
    expect(listedType(EPIC as ItemTypeDef).custom).toEqual([
      expect.objectContaining({ name: 'Stories', calculation: 'childCount', readOnly: true }),
      expect.objectContaining({ name: 'Progress', calculation: 'childrenDone', readOnly: true }),
    ]);
  });

  it('refuses giving one a value, before writing, by name', async () => {
    const { ctx, seen } = withCalc();
    const added = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'E', type: 'Epic', fields: ['progress=50'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(added).toMatchObject({
      code: 'field_calculated',
      message: expect.stringMatching(/^Progress is calculated: it can't be set/),
    });
    const set = await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['stories=9'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(set).toMatchObject({ code: 'field_calculated' });
    expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
  });

  it("words the api's own refusal", async () => {
    const { ctx } = api({
      [`${path}/itembbb111`]: () =>
        Response.json({ error: 'field_calculated', field: 'f-x' }, { status: 400 }),
    });
    const refusal = await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['priority=low'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(refusal).toMatchObject({
      code: 'field_calculated',
      message: expect.stringMatching(/calculated field is worked out/),
    });
  });
});

// docs/specs/026-plan/item-types.md "Formula fields".
describe('formula fields', () => {
  const DEAL = {
    ...ITEM_TYPES[0],
    id: 'deal',
    label: 'Deal',
    fields: ['title', 'status', 'f-budget', 'f-spent', 'f-left', 'f-grade', 'f-broken', 'f-link'],
    custom: [
      { id: 'f-budget', label: 'Budget', kind: 'currency' },
      { id: 'f-spent', label: 'Spent', kind: 'currency' },
      {
        id: 'f-left',
        label: 'Left',
        kind: 'calculated',
        calculation: 'formula',
        formula: '{f-budget} - {f-spent}',
        result: 'currency',
      },
      {
        id: 'f-grade',
        label: 'Grade',
        kind: 'calculated',
        calculation: 'formula',
        formula: 'concat({f-link})',
        result: 'text',
      },
      {
        id: 'f-broken',
        label: 'Broken',
        kind: 'calculated',
        calculation: 'formula',
        formula: '{f-gone}',
      },
      { id: 'f-link', label: 'Link', kind: 'card', linkType: 'deal' },
    ],
  };
  const items = [
    item(
      1,
      'itemdeal01',
      { title: 'Acme', status: 'doing', 'f-budget': 500, 'f-spent': 120 },
      'deal',
    ),
    item(2, 'itemdeal02', { title: 'Beta', status: 'doing', 'f-link': 'itemdeal01' }, 'deal'),
  ];
  const withFormula = () =>
    api({
      [`/projects/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, DEAL] },
      [path]: (r: Request) =>
        r.method === 'GET'
          ? Response.json({ items, rev: 4 })
          : Response.json({ item: items[0], rev: 5 }),
    });

  it('lists each card’s value, and the formula by names with its result and any problem', async () => {
    const { ctx } = withFormula();
    const out = await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: undefined });
    expect(out.items.find((i) => i.id === 'itemdeal01')!.fields).toMatchObject({
      Left: 380,
      Broken: null,
    });
    expect(out.items.find((i) => i.id === 'itemdeal02')!.fields).toMatchObject({
      Grade: '#1 Acme',
    });
    expect(listedType(DEAL as ItemTypeDef).custom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Left',
          calculation: 'formula',
          formula: 'Budget - Spent',
          result: 'currency',
          readOnly: true,
        }),
        expect.objectContaining({
          name: 'Broken',
          formula: '{deleted field}',
          result: 'number',
          formulaError: 'Uses a field that was deleted or taken off the type',
        }),
      ]),
    );
    expect(
      listedType(DEAL as ItemTypeDef).custom.find((f) => f.name === 'Left'),
    ).not.toHaveProperty('formulaError');
  });

  it('refuses giving one a value, saying its formula works it out', async () => {
    const { ctx, seen } = withFormula();
    const set = await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['left=9'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(set).toMatchObject({
      code: 'field_calculated',
      message: expect.stringMatching(/worked out by its formula\.$/),
    });
    expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
  });
});

// docs/specs/026-plan/item-types.md "Percent".
describe('percent fields', () => {
  const WORK = {
    ...ITEM_TYPES[1],
    id: 'work',
    label: 'Work',
    fields: ['title', 'status', 'f-progress', 'f-done'],
    custom: [
      { id: 'f-progress', label: 'Progress', kind: 'percent' },
      {
        id: 'f-done',
        label: 'Done',
        kind: 'calculated',
        calculation: 'childrenDone',
        showAs: 'percent',
      },
    ],
  };
  const withPercent = () =>
    api({ [`/projects/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, WORK] } });

  it('lists the kind, and a Children Done shown as a Percent', () => {
    expect(listedType(WORK as ItemTypeDef).custom).toEqual([
      { id: 'f-progress', name: 'Progress', kind: 'percent' },
      {
        id: 'f-done',
        name: 'Done',
        kind: 'calculated',
        calculation: 'childrenDone',
        showAs: 'percent',
        readOnly: true,
      },
    ]);
  });

  it('writes "40%" as 40, and refuses a share outside 0 to 100 before writing', async () => {
    const { ctx, seen } = withPercent();
    await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'W', type: 'Work', fields: ['progress=40%'] }),
    );
    expect(seen.find((s) => s.method === 'POST')!.body).toMatchObject({
      fields: { 'f-progress': 40 },
    });
    const refused = await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, title: 'W', type: 'Work', fields: ['progress=140'] }),
    ).catch((e: unknown) => e as VerbRefusal);
    expect(refused).toMatchObject({
      code: 'value_invalid',
      message: 'Progress is a percent: give a number from 0 to 100.',
    });
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(1);
  });
});

describe('required fields (docs/specs/026-plan/item-types.md "Required fields")', () => {
  const required = {
    ...BUG,
    fields: [...BUG.fields, 'f-severity', 'f-area'],
    custom: [
      { id: 'f-severity', label: 'Severity', kind: 'text', required: true },
      { id: 'f-area', label: 'Area', kind: 'text', required: true },
    ],
  };
  const withRequired = (extra: Record<string, unknown> = {}) =>
    api({
      [`/projects/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, required] },
      ...extra,
    });

  // A run that must refuse: its refusal, or a failure when it went through.
  const refused = (run: Promise<unknown>) =>
    run.then(
      () => {
        throw new Error('not refused');
      },
      (e: unknown) => e as VerbRefusal,
    );

  it('refuses a new card without them before writing, naming each', async () => {
    const { ctx, seen } = withRequired();
    const refusal = await refused(
      itemAdd.run!(
        ctx,
        itemAdd.input.parse({ project: DOC_A, title: 'Crash', type: 'Bug', fields: ['area=UI'] }),
      ),
    );
    expect(refusal).toMatchObject({ code: 'field_required' });
    expect(refusal.message).toMatch(/^Bug cards need Severity: give it in fields, by name/);
    expect(seen).toEqual([]);
    const both = await refused(
      itemAdd.run!(ctx, itemAdd.input.parse({ project: DOC_A, title: 'Crash', type: 'Bug' })),
    );
    expect(both.message).toMatch(/^Bug cards need Severity and Area: give them/);
    await itemAdd.run!(
      ctx,
      itemAdd.input.parse({
        project: DOC_A,
        title: 'Crash',
        type: 'Bug',
        fields: ['severity=S1', 'area=UI'],
      }),
    );
    expect(seen).toHaveLength(1);
  });

  it('refuses a change that empties one, and lets any other through', async () => {
    const filled = item(
      1,
      'itembbb111',
      { title: 'Fix login', status: 'doing', 'f-severity': 'S1', 'f-area': 'UI' },
      'bug',
    );
    const { ctx, seen } = withRequired({
      [path]: () => Response.json({ items: [filled], rev: 4 }),
    });
    const refusal = await refused(
      itemSet.run!(ctx, itemSet.input.parse({ project: DOC_A, item: '#1', clear: ['Severity'] })),
    );
    expect(refusal).toMatchObject({ code: 'field_required' });
    expect(refusal.message).toBe(
      'Severity is required on Bug cards: it can be changed, not emptied.',
    );
    await itemSet.run!(
      ctx,
      itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['severity=S2'] }),
    );
    expect(seen).toHaveLength(1);
  });

  it("words the api's own refusal", async () => {
    const { ctx } = api({
      [`${path}/itembbb111`]: () =>
        Response.json({ error: 'field_required', field: 'f-severity' }, { status: 400 }),
    });
    const refusal = await refused(
      itemSet.run!(
        ctx,
        itemSet.input.parse({ project: DOC_A, item: '#1', fields: ['priority=low'] }),
      ),
    );
    expect(refusal).toMatchObject({ code: 'field_required' });
    expect(refusal.message).toMatch(/required custom field would be left empty/);
  });
});
