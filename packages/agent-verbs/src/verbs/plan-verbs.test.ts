import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { boardAdd, boardSet } from './board';
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
    [`/documents/${DOC_A}/plan`]: PLAN,
    [`/documents/${DOC_A}/items`]: { items: [], rev: 0 },
    [`/documents/${DOC_A}/item-types`]: (r: Request) => keep(r, { itemTypes: null }),
    [`/documents/${DOC_A}/tabs/${TAB}`]: { tab: { id: TAB, elements: [BOARD_EL], rev: 3 } },
    [`/documents/${DOC_A}/tabs/${TAB}/changesets`]: (r: Request) =>
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
      boardAdd.input.parse({ doc: DOC_A, columns: 'Ideas, Doing ,Shipped', title: 'Roadmap' }),
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
      boardAdd.run!(ctx, boardAdd.input.parse({ doc: DOC_A, types: 'Epic' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });
});

describe('type ls and apply', () => {
  it('lists the card types', async () => {
    const { ctx } = ctxWith();
    const out = await typeLs.run!(ctx, { doc: DOC_A });
    expect(typeLs.quiet!(out)).toEqual(ITEM_TYPES.map((t) => t.id));
    expect(typeLs.text!(out)[1]).toMatch(/^task\s+"Task"/);
  });

  it('applies changes from a file, printing the ids it made', async () => {
    const { ctx, sent } = ctxWith(
      '[{"op":"add","name":"Bug","custom":[{"name":"Severity","kind":"text"}]}]',
    );
    const out = await typeApply.run!(ctx, { doc: DOC_A, file: 'types.json' });
    expect(typeApply.text!(out)).toEqual(['+ Bug (bug): Severity (f-severity)']);
    expect(typeApply.quiet!(out)).toEqual(out.applied);
    expect(sent).toHaveLength(1);
  });

  it('refuses a file that is not a list of changes, and a change it cannot make', async () => {
    const bad = ctxWith('[{"op":"rename"}]').ctx;
    await expect(typeApply.run!(bad, { doc: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'usage',
    });
    const refused = ctxWith('[{"op":"delete","type":"Epic"}]').ctx;
    await expect(typeApply.run!(refused, { doc: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'type_unknown',
    });
  });
});

describe('board set', () => {
  it('changes the columns and card types, printing what it takes', async () => {
    const { ctx, sent } = ctxWith();
    const out = await boardSet.run!(
      ctx,
      boardSet.input.parse({ doc: DOC_A, board: 'sprint', columns: 'To Do, Done', types: 'Task' }),
    );
    expect(boardSet.text!(out)).toEqual(['~ board "Sprint": To Do · Done (takes Task)']);
    expect(boardSet.quiet!(out)).toEqual(['b1']);
    expect(sent[0]).toMatchObject({ operations: [{ op: 'set', target: 'id:"b1"' }] });
    const every = await boardSet.run!(
      ctx,
      boardSet.input.parse({ doc: DOC_A, board: 'b1', types: 'all', title: 'S2' }),
    );
    expect(boardSet.text!(every)).toEqual(['~ board "S2": To Do (takes every type)']);
  });

  it('refuses a board it cannot find', async () => {
    const { ctx } = ctxWith();
    await expect(
      boardSet.run!(ctx, boardSet.input.parse({ doc: DOC_A, board: 'Roadmap' })),
    ).rejects.toMatchObject({
      code: 'board_unknown',
      status: 404,
    });
    await expect(
      boardSet.run!(ctx, boardSet.input.parse({ doc: DOC_A, board: 'Sprint', columns: 'A,a' })),
    ).rejects.toMatchObject({ code: 'board_invalid' });
  });
});

describe('verb edges', () => {
  it('adds a board on a named tab from a preset', async () => {
    const { ctx } = ctxWith();
    const out = await boardAdd.run!(
      ctx,
      boardAdd.input.parse({ doc: DOC_A, tab: TAB, preset: 'todo' }),
    );
    expect(out.tabId).toBe(TAB);
  });

  it('lists custom fields, refuses a file that is not JSON, and prints trashed cards', async () => {
    const custom = {
      ...ITEM_TYPES[1],
      id: 'bug',
      label: 'Bug',
      custom: [{ id: 'f-sev', label: 'Severity', kind: 'text' }],
    };
    const { ctx } = ctxWith('', {
      [`/documents/${DOC_A}/plan`]: { ...PLAN, types: [...ITEM_TYPES, custom] },
    });
    const ls = await typeLs.run!(ctx, { doc: DOC_A });
    expect(typeLs.text!(ls).at(-1)).toContain('Severity:text (f-sev)');
    const notJson = ctxWith('not json').ctx;
    await expect(typeApply.run!(notJson, { doc: DOC_A, file: '-' })).rejects.toMatchObject({
      code: 'usage',
    });
    expect(typeApply.text!({ applied: ['- Bug (bug)'], trashed: ['#3'] })).toEqual([
      '- Bug (bug)',
      'moved to the Trash: #3',
    ]);
  });
});
