import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { boardAdd, boardSet, sortLevels } from './board';
import { typeApply, typeLs } from './card-type';

// The board and card type verbs (docs/specs/026-plan/plan-agents.md; docs/specs/015-api/cli.md "Commands").
// The first tab as shown: the lowest orderIndex, wherever the api lists it.
const TAB = 'tab-one-0000';
const PLAN = {
  boards: [
    {
      tabId: TAB,
      tabName: 'Overview',
      elementId: 'b1',
      title: 'Sprint',
      kind: 'board',
      types: null,
      columns: [{ status: 'todo~a', name: 'To Do' }],
    },
  ],
  statuses: [{ status: 'todo~a', name: 'To Do' }],
  types: ITEM_TYPES,
};
const BOARD_EL = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  planBoard: {
    title: 'Sprint',
    columns: [{ id: 'todo', status: 'todo~a', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: ['key'],
    voting: { on: false },
    hideWriting: false,
  },
};

function ctxWith(input = '', extra: Record<string, unknown> = {}) {
  const sent: unknown[] = [];
  const keep = async (r: Request, answer: unknown) => {
    sent.push(JSON.parse(await r.text()));
    return Response.json(answer);
  };
  const api = fakeApi({
    ...library,
    ...tabsOfA,
    [`/projects/${DOC_A}/plan`]: PLAN,
    [`/projects/${DOC_A}/items`]: { items: [], rev: 0 },
    [`/projects/${DOC_A}/item-types`]: (r: Request) => keep(r, { itemTypes: null }),
    [`/projects/${DOC_A}/tabs/${TAB}`]: {
      tab: { id: TAB, elements: [BOARD_EL], rev: 3 },
    },
    [`/projects/${DOC_A}/tabs/${TAB}/changesets`]: (r: Request) =>
      keep(r, { changeset: { id: 'cs', rev: 4 } }),
    ...extra,
  });
  return { ctx: contextOf(api, [], [], { readInput: async () => input }), sent };
}

describe('board add', () => {
  it('adds a board by column names and prints its columns', async () => {
    const { ctx, sent } = ctxWith();
    const out = await boardAdd.run!(
      ctx,
      boardAdd.input.parse({ project: DOC_A, columns: 'Ideas, Doing ,Shipped', title: 'Roadmap' }),
    );
    expect(boardAdd.text!(out)).toEqual(['+ board "Roadmap": Ideas · Doing · Shipped']);
    expect(boardAdd.quiet!(out)).toEqual([out.elementId]);
    expect(sent[0]).toMatchObject({
      operations: [{ op: 'add', element: { shape: 'plan-board' } }],
    });
  });

  it('refuses an unknown card type', async () => {
    const { ctx } = ctxWith();
    await expect(
      boardAdd.run!(ctx, boardAdd.input.parse({ project: DOC_A, types: 'Epic' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });
});

describe('type ls and apply', () => {
  it('lists the card types', async () => {
    const { ctx } = ctxWith();
    const out = await typeLs.run!(ctx, { project: DOC_A });
    expect(typeLs.quiet!(out)).toEqual(ITEM_TYPES.map((t) => t.id));
    expect(typeLs.text!(out)[1]).toMatch(/^task\s+"Task"/);
  });

  it('applies changes from a file, printing the ids it made', async () => {
    const { ctx, sent } = ctxWith(
      '[{"op":"add","name":"Bug","custom":[{"name":"Severity","kind":"text"}]}]',
    );
    const out = await typeApply.run!(ctx, { project: DOC_A, file: 'types.json' });
    expect(typeApply.text!(out)).toEqual(['+ Bug (bug): Severity (f-severity)']);
    expect(typeApply.quiet!(out)).toEqual(out.applied);
    expect(sent).toHaveLength(1);
  });

  it('refuses a file that is not a list of changes, and a change it cannot make', async () => {
    const bad = ctxWith('[{"op":"rename"}]').ctx;
    await expect(typeApply.run!(bad, { project: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'usage',
    });
    const refused = ctxWith('[{"op":"delete","type":"Epic"}]').ctx;
    await expect(typeApply.run!(refused, { project: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'type_unknown',
    });
  });
});

describe('board set', () => {
  it('changes the columns and card types, printing what it takes', async () => {
    const { ctx, sent } = ctxWith();
    const out = await boardSet.run!(
      ctx,
      boardSet.input.parse({
        project: DOC_A,
        board: 'sprint',
        columns: 'To Do, Done',
        types: 'Task',
      }),
    );
    // Done counts as done by its name (docs/specs/026-plan/plan-board.md "Done columns").
    expect(boardSet.text!(out)).toEqual(['~ board "Sprint": To Do · Done ✓ (takes Task)']);
    expect(boardSet.quiet!(out)).toEqual(['b1']);
    expect(sent[0]).toMatchObject({ operations: [{ op: 'set', target: 'id:"b1"' }] });
    const every = await boardSet.run!(
      ctx,
      boardSet.input.parse({ project: DOC_A, board: 'b1', types: 'all', title: 'S2' }),
    );
    expect(boardSet.text!(every)).toEqual(['~ board "S2": To Do (takes every type)']);
    expect(boardSet.text!({ ...every, takes: [] })).toEqual([
      '~ board "S2": To Do (takes no type)',
    ]);
    // --done names the done columns, whole; none turns them all off.
    const done = await boardSet.run!(
      ctx,
      boardSet.input.parse({ project: DOC_A, board: 'b1', done: 'To Do' }),
    );
    expect(done.columns).toEqual([expect.objectContaining({ name: 'To Do', done: true })]);
    const none = await boardSet.run!(
      ctx,
      boardSet.input.parse({ project: DOC_A, board: 'b1', done: 'none' }),
    );
    expect(none.columns[0]).not.toHaveProperty('done');
  });

  it('sorts the board from --sort, and prints the sort', async () => {
    const { ctx, sent } = ctxWith();
    const out = await boardSet.run!(
      ctx,
      boardSet.input.parse({ project: DOC_A, board: 'sprint', sort: 'Priority desc, Due Date' }),
    );
    expect(sent[0]).toMatchObject({
      operations: [
        {
          fields: {
            planBoard: {
              sortBy: [
                { field: 'priority', dir: 'desc' },
                { field: 'due', dir: 'asc' },
              ],
            },
          },
        },
      ],
    });
    expect(boardSet.text!(out)[0]).toContain(
      ', sorted by Priority (Highest First), then Due Date (Earliest First)',
    );
  });

  it('reads --sort levels, each direction optional, none as none', () => {
    expect(sortLevels('Priority descending, Value ASC, Due Date')).toEqual([
      { field: 'Priority', direction: 'descending' },
      { field: 'Value', direction: 'ascending' },
      { field: 'Due Date' },
    ]);
    expect(sortLevels(' None ')).toEqual([]);
    expect(sortLevels(' , ')).toEqual([]);
  });

  it('refuses a board it cannot find', async () => {
    const { ctx } = ctxWith();
    await expect(
      boardSet.run!(ctx, boardSet.input.parse({ project: DOC_A, board: 'Roadmap' })),
    ).rejects.toMatchObject({
      code: 'board_unknown',
      status: 404,
    });
    await expect(
      boardSet.run!(ctx, boardSet.input.parse({ project: DOC_A, board: 'Sprint', columns: 'A,a' })),
    ).rejects.toMatchObject({ code: 'board_invalid' });
  });
});

describe('verb edges', () => {
  it('adds a board on a named tab from a preset', async () => {
    const { ctx } = ctxWith();
    const out = await boardAdd.run!(
      ctx,
      boardAdd.input.parse({ project: DOC_A, tab: TAB, preset: 'todo' }),
    );
    expect(out.tabId).toBe(TAB);
  });

  it('lists custom fields, refuses a file that is not JSON, and prints trashed cards', async () => {
    const custom = {
      ...ITEM_TYPES[1],
      id: 'bug',
      label: 'Bug',
      custom: [
        { id: 'f-sev', label: 'Severity', kind: 'text' },
        { id: 'f-area', label: 'Area', kind: 'text', required: true },
      ],
    };
    const { ctx } = ctxWith('', {
      [`/projects/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, custom] },
    });
    const ls = await typeLs.run!(ctx, { project: DOC_A });
    expect(typeLs.text!(ls).at(-1)).toContain('Severity:text (f-sev), Area*:text (f-area)');
    // list_items and type ls mark a required field (docs/specs/026-plan/item-types.md "Required fields").
    expect(ls.types.at(-1)!.custom).toEqual([
      { id: 'f-sev', name: 'Severity', kind: 'text' },
      { id: 'f-area', name: 'Area', kind: 'text', required: true },
    ]);
    const notJson = ctxWith('not json').ctx;
    await expect(typeApply.run!(notJson, { project: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'usage',
    });
    expect(typeApply.text!({ applied: ['- Bug (bug)'], trashed: ['#3'] })).toEqual([
      '- Bug (bug)',
      'moved to the Trash: #3',
    ]);
  });
});
