// Card tables (docs/specs/029-sheets/sheet.md "Card tables"): cards to rows (pull) and rows to cards (push).
import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import {
  applySheetWrite,
  cellKey,
  emptyLayout,
  Workbook,
  type CardTable,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { cardCell, pullChanges, pushPlan, rowSave, type CardPlan } from './card-table-sync';

let seq = 3;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const by = { id: 'p', name: 'P', color: '#000000' };
const ctx = { now: 1, by };
const layout = emptyLayout(rand, 8, 5);
const R = layout.rows;
const C = layout.cols;

const card = (key: number, fields: Item['fields'], type = 'task'): Item => ({
  id: `i${key}`,
  type,
  key,
  rank: 'a',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});

const plan = (items: Item[]): CardPlan => ({
  items: new Map(items.map((i) => [i.id, i])),
  types: ITEM_TYPES,
  statusNames: new Map([
    ['todo', 'To Do'],
    ['done', 'Done'],
  ]),
});

const table: CardTable = {
  id: 'tbl1',
  head: R[0]!,
  cols: [
    { c: C[0]!, field: 'Number' },
    { c: C[1]!, field: 'Title' },
    { c: C[2]!, field: 'State' },
    { c: C[3]!, field: 'Due' },
    { c: C[4]!, field: 'Type' },
  ],
  rows: { [R[1]!]: 'i1', [R[2]!]: 'i2' },
  type: 'task',
};

function sheetOf(cells: Record<string, string | number> = {}): Sheet {
  const map = new Map();
  for (const [k, v] of Object.entries(cells)) {
    const [r, c] = k.split(',').map(Number);
    map.set(cellKey(R[r!]!, C[c!]!), { input: typeof v === 'number' ? { n: v } : { s: v } });
  }
  return {
    id: 'sheetAAAA',
    tabId: 't1',
    title: 'Cards',
    layout: { ...layout, cardTables: [table] },
    cells: map,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: by,
  };
}

// This person's write, applied: what push reads.
function edit(before: Sheet, write: SheetWrite) {
  const after = applySheetWrite(before, write, ctx).sheet;
  const wb = new Workbook({ sheets: [after], locale: 'en-GB' });
  return { after, wb };
}

const items = () =>
  plan([
    card(1, { title: 'Write', status: 'todo', due: '2026-10-20' }),
    card(2, { title: 'Ship', status: 'done' }),
  ]);

describe('a card field as a cell', () => {
  it('writes numbers, dates, text and blanks', () => {
    expect(cardCell(3, 'Estimate')).toEqual({ i: { n: 3 } });
    expect(cardCell(46000, 'Due')).toEqual({ i: { n: 46000 }, f: { nf: 'date' } });
    expect(cardCell('x', 'Title')).toEqual({ i: { s: 'x' } });
    expect(cardCell(true, 'Done')).toEqual({ i: { s: 'true' } });
    expect(cardCell('', 'Title')).toEqual({ i: null });
  });
});

describe('cards to rows', () => {
  it('rewrites only the cells that differ from their cards', () => {
    const s = sheetOf({
      '1,0': 1,
      '1,1': 'Old',
      '1,2': 'To Do',
      '1,4': 'Task',
      '2,0': 2,
      '2,1': 'Ship',
    });
    const cells = pullChanges(s, items());
    const at = (r: number, c: number) => cells.find((x) => x.r === R[r] && x.c === C[c]);
    expect(at(1, 1)?.i).toEqual({ s: 'Write' });
    expect(at(1, 3)).toMatchObject({ i: { n: expect.any(Number) }, f: { nf: 'date' } });
    expect(at(1, 2)).toBeUndefined();
    expect(at(2, 2)?.i).toEqual({ s: 'Done' });
    // Nothing more once they match.
    const next = applySheetWrite(s, { kind: 'cells', cells }, ctx).sheet;
    expect(pullChanges(next, items())).toEqual([]);
  });

  it('leaves a trashed or gone card, and a sheet without tables, alone', () => {
    const gone = plan([card(1, { title: 'Write', status: 'trash' })]);
    expect(pullChanges(sheetOf(), gone)).toEqual([]);
    expect(pullChanges({ ...sheetOf(), layout }, items())).toEqual([]);
  });
});

describe('rows to cards', () => {
  const save = (
    before: Sheet,
    cells: { r: string; c: string; i: unknown }[],
    row: string,
    p = items(),
  ) => {
    const { after, wb } = edit(before, { kind: 'cells', cells } as SheetWrite);
    return rowSave(after, wb, p, 'tbl1', row);
  };

  it('marks the rows an edit touched in the table as drafts, once each', () => {
    const before = sheetOf();
    const cells = [
      { r: R[1]!, c: C[1]!, i: { s: 'x' } },
      { r: R[1]!, c: C[2]!, i: { s: 'y' } },
      { r: R[3]!, c: C[1]!, i: { s: 'new' } },
      { r: R[5]!, c: C[1]!, i: { s: 'far' } },
    ];
    const { after } = edit(before, { kind: 'cells', cells });
    expect(pushPlan(before, after, { kind: 'cells', cells }, items()).drafts).toEqual([
      { tableId: 'tbl1', row: R[1] },
      { tableId: 'tbl1', row: R[3] },
    ]);
    // Already a draft: nothing new.
    const drafted = {
      ...after,
      layout: { ...after.layout, cardTables: [{ ...table, drafts: [R[1]!] }] },
    };
    expect(
      pushPlan(before, drafted, { kind: 'cells', cells: cells.slice(0, 1) }, items()).drafts,
    ).toEqual([]);
  });

  it('leaves a draft row alone when cards change', () => {
    const s = sheetOf({ '1,1': 'Mine' });
    const drafted = { ...s, layout: { ...s.layout, cardTables: [{ ...table, drafts: [R[1]!] }] } };
    expect(pullChanges(drafted, items()).some((x) => x.r === R[1])).toBe(false);
  });

  it("saves a row's changed fields, by the names people use, and clears emptied ones", () => {
    const before = sheetOf({ '1,0': 1, '1,1': 'Write', '1,2': 'To Do', '1,4': 'Task' });
    const out = save(
      before,
      [
        { r: R[1]!, c: C[1]!, i: { s: 'Write well' } },
        { r: R[1]!, c: C[2]!, i: { s: 'done' } },
        { r: R[1]!, c: C[3]!, i: null },
        { r: R[1]!, c: C[0]!, i: { n: 99 } },
      ],
      R[1]!,
    );
    expect(out).toEqual({
      kind: 'patch',
      id: 'i1',
      patch: { set: { title: 'Write well', status: 'done' }, clear: ['due'] },
    });
  });

  it("keeps a card's title and state when their cells are cleared", () => {
    const before = sheetOf({
      '1,0': 1,
      '1,1': 'Write',
      '1,2': 'To Do',
      '1,3': 46315,
      '1,4': 'Task',
    });
    const out = save(
      before,
      [
        { r: R[1]!, c: C[1]!, i: null },
        { r: R[1]!, c: C[2]!, i: null },
      ],
      R[1]!,
    );
    expect(out).toEqual({ kind: 'none' });
  });

  it('writes a date as the card date and a type by its name, and refuses an unknown state or type', () => {
    const before = sheetOf({ '2,0': 2, '2,1': 'Ship', '2,2': 'Done' });
    expect(
      save(
        before,
        [
          { r: R[2]!, c: C[3]!, i: { n: 46000 } },
          { r: R[2]!, c: C[4]!, i: { s: 'Idea' } },
        ],
        R[2]!,
      ),
    ).toMatchObject({
      kind: 'patch',
      id: 'i2',
      patch: { type: 'idea', set: { due: '2025-12-09' } },
    });
    expect(save(before, [{ r: R[2]!, c: C[2]!, i: { s: 'Doing' } }], R[2]!)).toMatchObject({
      kind: 'refused',
      message: expect.stringMatching(/Doing/),
    });
    expect(save(before, [{ r: R[2]!, c: C[4]!, i: { s: 'Nope' } }], R[2]!)).toMatchObject({
      kind: 'refused',
    });
    // Nothing changed (an empty Type cell is left as it is): nothing to write.
    expect(save(before, [], R[2]!)).toEqual({ kind: 'none' });
  });

  it("makes a card of a new row, with its type and the first card's state, or its own", () => {
    const before = sheetOf();
    expect(save(before, [{ r: R[3]!, c: C[1]!, i: { s: 'New one' } }], R[3]!)).toEqual({
      kind: 'create',
      create: {
        tableId: 'tbl1',
        row: R[3],
        type: 'task',
        status: 'todo',
        fields: { title: 'New one' },
      },
    });
    const own = save(
      before,
      [
        { r: R[3]!, c: C[4]!, i: { s: 'Idea' } },
        { r: R[3]!, c: C[2]!, i: { s: 'Done' } },
      ],
      R[3]!,
    );
    expect(own).toMatchObject({ kind: 'create', create: { type: 'idea', status: 'done' } });
    expect(own.kind === 'create' && own.create.fields['title']).toBeTruthy();
    expect(save(before, [], R[3]!)).toEqual({ kind: 'none' });
    expect(save(before, [{ r: R[3]!, c: C[4]!, i: { s: 'Nope' } }], R[3]!)).toMatchObject({
      kind: 'refused',
    });
    expect(save(before, [{ r: R[3]!, c: C[2]!, i: { s: 'Doing' } }], R[3]!)).toMatchObject({
      kind: 'refused',
    });
  });

  it('makes a card of a row linked to a card that was never made, and leaves a trashed one', () => {
    const ghost = {
      ...sheetOf(),
      layout: { ...layout, cardTables: [{ ...table, rows: { ...table.rows, [R[3]!]: 'ghost' } }] },
    };
    expect(save(ghost, [{ r: R[3]!, c: C[1]!, i: { s: 'Again' } }], R[3]!)).toMatchObject({
      kind: 'create',
    });
    const trashed = plan([
      card(1, { title: 'Write', status: 'trash' }),
      card(2, { title: 'Ship' }),
    ]);
    expect(save(sheetOf(), [{ r: R[1]!, c: C[1]!, i: { s: 'x' } }], R[1]!, trashed)).toEqual({
      kind: 'none',
    });
    expect(
      rowSave(
        sheetOf(),
        new Workbook({ sheets: [sheetOf()], locale: 'en-GB' }),
        items(),
        'nope',
        R[1]!,
      ),
    ).toEqual({ kind: 'none' });
  });

  it('moves the cards of deleted linked rows to the Trash', () => {
    const before = sheetOf();
    const write: SheetWrite = {
      kind: 'layout',
      changes: [{ k: 'deleteRows', ids: [R[1]!, R[5]!] }],
    };
    const { after } = edit(before, write);
    expect(pushPlan(before, after, write, items()).trash).toEqual(['i1']);
  });

  it('does nothing for a sheet without card tables or a title change', () => {
    const plain = { ...sheetOf(), layout };
    expect(pushPlan(plain, plain, { kind: 'title', title: 'x' }, items())).toEqual({
      drafts: [],
      trash: [],
    });
  });
});
