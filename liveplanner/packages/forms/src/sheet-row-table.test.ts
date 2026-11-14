// A response on a template's table with a total (docs/specs/030-forms/forms.md "A template's table with a total"):
// inside the table, above the total, which grows to count it; a sheet a person has made their own keeps appending.
import { describe, expect, it } from 'vitest';
import {
  Workbook,
  applySheetWrite,
  cellKey,
  sheetFromJson,
  sheetFromTemplate,
  type CellInput,
  type Sheet,
} from '@liveplanner/sheets';
import { headerRowIndex, topRowTexts, type SheetForm } from './sheet-columns';
import { isTotalRow, responseRowWrite, type SheetTable } from './sheet-row';

const AT = Date.UTC(2026, 9, 15, 14, 3);
const form: SheetForm = {
  sections: [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name' },
        { id: 'q-email', type: 'short', prompt: 'Email' },
      ],
    },
  ],
};
const answers = new Map([
  ['q-name', 'Ada Lovelace'],
  ['q-email', 'ada@example.com'],
]);

let seed = 0;
const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

function contacts(): Sheet {
  const made = sheetFromTemplate({
    id: 'sheetT0001',
    tabId: 't',
    template: 'contacts',
    now: Date.UTC(2026, 9, 11),
    dark: false,
    rand,
  })!;
  return sheetFromJson({
    ...made.sheet,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: 'x', name: 'x', color: '#000000' },
  });
}

const inputsOf = (sheet: Sheet, row: string) => {
  const out = new Map<string, CellInput>();
  for (const c of sheet.layout.cols) {
    const i = sheet.cells.get(cellKey(row, c))?.input;
    if (i) out.set(c, i);
  }
  return out;
};
const used = (sheet: Sheet, row: string) => inputsOf(sheet, row).size > 0;

// What the api reads (sheet-response.ts): the last used row, and the table when it is a total.
function respond(sheet: Sheet, number: number): Sheet {
  const { rows } = sheet.layout;
  const rowTexts = topRowTexts(sheet);
  const lastIndex = rows.findLastIndex((r) => used(sheet, r));
  const head = headerRowIndex(form, rows, rowTexts);
  const lastInputs = inputsOf(sheet, rows[lastIndex]!);
  const table: SheetTable | undefined =
    lastIndex > head && isTotalRow(lastInputs.values())
      ? {
          total: rows[lastIndex]!,
          totalInputs: lastInputs,
          empty: rows.slice(head + 1, lastIndex).find((r) => !used(sheet, r)) ?? null,
          aboveInputs: inputsOf(sheet, rows[lastIndex - 1]!),
        }
      : undefined;
  const write = responseRowWrite({
    form,
    answers,
    number,
    preview: false,
    at: AT,
    layout: sheet.layout,
    rowTexts,
    usedRows: new Set([rows[lastIndex]!]),
    table,
    rand,
  });
  return applySheetWrite(sheet, write, {
    now: AT,
    by: { id: 'f', name: 'Form', color: '#000000' },
  }).sheet;
}

const text = (sheet: Sheet, r: number, c: number) => {
  const i = sheet.cells.get(cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!))?.input;
  return i && 's' in i ? i.s : undefined;
};
const value = (sheet: Sheet, r: number, c: number) =>
  new Workbook({ sheets: [sheet], locale: 'en-GB' }).value(sheet.id, r, c);

describe('a response on a fresh Contacts sheet', () => {
  it('lands inside the table, above the total, and the total counts it', () => {
    const fresh = contacts();
    // Row 11 (index 10) holds the total: "6 contacts".
    expect(value(fresh, 10, 0)).toBe('6 contacts');
    const once = respond(fresh, 1);
    expect(once.layout.rows).toHaveLength(fresh.layout.rows.length + 1);
    expect(text(once, 10, 0)).toBe('Ada Lovelace');
    expect(text(once, 10, 3)).toBe('ada@example.com');
    expect(value(once, 11, 0)).toBe('7 contacts');
    // The next one goes under it, still above the total.
    const twice = respond(once, 2);
    expect(text(twice, 11, 0)).toBe('Ada Lovelace');
    expect(value(twice, 12, 0)).toBe('8 contacts');
    // The headers the form adds sit on the template's header row (row 4).
    expect(text(twice, 3, 10)).toBe('#');
  });

  it('takes the first empty row inside the table before adding one', () => {
    let sheet = contacts();
    // An example person cleared from row 6 (index 5).
    const row = sheet.layout.rows[5]!;
    const cells = new Map(sheet.cells);
    for (const c of sheet.layout.cols) cells.delete(cellKey(row, c));
    sheet = { ...sheet, cells };
    const next = respond(sheet, 1);
    expect(next.layout.rows).toEqual(sheet.layout.rows);
    expect(text(next, 5, 0)).toBe('Ada Lovelace');
  });

  it('keeps appending on a sheet with values under its total', () => {
    const fresh = contacts();
    const below = fresh.layout.rows[12]!;
    const sheet: Sheet = {
      ...fresh,
      cells: new Map(fresh.cells).set(cellKey(below, fresh.layout.cols[0]!), {
        input: { s: 'Grace Hopper' },
      }),
    };
    const next = respond(sheet, 1);
    expect(text(next, 13, 0)).toBe('Ada Lovelace');
    expect(value(next, 10, 0)).toBe('6 contacts');
  });
});

describe("a new row's per-row formulas", () => {
  it("takes the row above's Days Since and Follow Up, on its own row", () => {
    const once = respond(contacts(), 1);
    const { rows, cols } = once.layout;
    // Days Since (H) and Follow Up (I) on the response's row (index 10) read its own Last Contacted (G) and H.
    const days = once.cells.get(cellKey(rows[10]!, cols[7]!))?.input;
    expect(days && 'f' in days ? days.f.r : []).toEqual([{ r1: rows[10], c1: cols[6] }]);
    expect(typeof value(once, 10, 7)).toBe('number');
    const follow = once.cells.get(cellKey(rows[10]!, cols[8]!))?.input;
    expect(follow && 'f' in follow ? follow.f.r : []).toEqual([{ r1: rows[10], c1: cols[7] }]);
    // The example row above keeps its own.
    const before = once.cells.get(cellKey(rows[9]!, cols[7]!))?.input;
    expect(before && 'f' in before ? before.f.r : []).toEqual([{ r1: rows[9], c1: cols[6] }]);
  });

  it('moves references to earlier rows down one, keeps absolute rows, and leaves out what it cannot move', () => {
    const rows = ['h', 'a', 'b', 't'];
    const layout = { rows, cols: ['ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg', 'ch', 'ci'] };
    const f = (r: object[]) => ({ f: { t: 'SUM(@0)', r } }) as CellInput;
    const write = responseRowWrite({
      form,
      answers,
      number: 1,
      preview: false,
      at: AT,
      layout,
      rowTexts: new Map([
        [
          'h',
          new Map([
            ['ca', 'Name'],
            ['cb', 'Email'],
            // # and Submitted already at the far end, so the formula columns are free.
            ['ch', '#'],
            ['ci', 'Submitted'],
          ]),
        ],
      ]),
      usedRows: new Set(['t']),
      table: {
        total: 't',
        totalInputs: new Map(),
        empty: null,
        aboveInputs: new Map<string, CellInput>([
          // A running balance: the row before (a) and its own (b).
          [
            'cc',
            f([
              { r1: 'a', c1: 'cc' },
              { r1: 'b', c1: 'cd' },
              { r1: 'a', c1: 'cc', r2: 'b', c2: 'cc' },
            ]),
          ],
          // An absolute row and a whole column stay.
          [
            'cd',
            f([
              { r1: 'a', c1: 'cd', a: 1 },
              { c1: 'cd', c2: 'cd' },
              { s: 'other', r1: 'a', c1: 'cd', r2: 'b', c2: 'cd', a: 5 },
            ]),
          ],
          // Below the row above, or another sheet's row: left out.
          ['ce', f([{ r1: 't', c1: 'ce' }])],
          ['cf', f([{ s: 'other', r1: 'a', c1: 'cf' }])],
          ['cg', { s: 'text' }],
          // A column the response writes (Name) is the response's.
          ['ca', f([{ r1: 'b', c1: 'ca' }])],
        ]),
      },
      rand,
    });
    if (write.kind !== 'layout') throw new Error('a layout write');
    const added = (write.changes.find((c) => c.k === 'insertRows') as { ids: string[] }).ids[0]!;
    const copied = new Map(
      (write.cells ?? [])
        .filter((c) => c.r === added && 'f' in c.i!)
        .map((c) => [c.c, (c.i as { f: { r: object[] } }).f.r]),
    );
    expect([...copied.keys()]).toEqual(['cc', 'cd']);
    expect(copied.get('cc')).toEqual([
      { r1: 'b', c1: 'cc' },
      { r1: added, c1: 'cd' },
      { r1: 'b', c1: 'cc', r2: added, c2: 'cc' },
    ]);
    expect(copied.get('cd')).toEqual([
      { r1: 'a', c1: 'cd', a: 1 },
      { c1: 'cd', c2: 'cd' },
      { s: 'other', r1: 'a', c1: 'cd', r2: 'b', c2: 'cd', a: 5 },
    ]);
  });
});

describe('isTotalRow', () => {
  const ref = { r1: 'a', c1: 'x', r2: 'b', c2: 'x' };
  it('is every input a formula with one over a range of rows', () => {
    expect(isTotalRow([{ f: { t: 'SUM(@0)', r: [ref] } }])).toBe(true);
    expect(isTotalRow([{ f: { t: 'SUM(@0)', r: [ref] } }, { s: 'Total' }])).toBe(false);
    // One row, another sheet's range, or no range at all: not a total.
    expect(isTotalRow([{ f: { t: '@0', r: [{ r1: 'a', c1: 'x' }] } }])).toBe(false);
    expect(isTotalRow([{ f: { t: 'SUM(@0)', r: [{ ...ref, s: 'other' }] } }])).toBe(false);
    expect(isTotalRow([{ f: { t: 'TODAY()', r: [] } }])).toBe(false);
    expect(isTotalRow([])).toBe(false);
  });
});

describe('a table given without a total under the header', () => {
  it('appends as before when the total is not under the header row', () => {
    const sheet = contacts();
    const write = responseRowWrite({
      form,
      answers,
      number: 1,
      preview: false,
      at: AT,
      layout: sheet.layout,
      rowTexts: topRowTexts(sheet),
      usedRows: new Set([sheet.layout.rows[10]!]),
      table: { total: sheet.layout.rows[0]!, totalInputs: new Map(), empty: null },
      rand,
    });
    const rows = write.kind === 'title' ? [] : (write.cells ?? []).filter((c) => !c.f);
    expect(new Set(rows.map((c) => c.r))).toEqual(new Set([sheet.layout.rows[11]!]));
  });

  it('leaves alone total cells that are not formulas or do not end above the new row', () => {
    const sheet = contacts();
    const total = sheet.layout.rows[10]!;
    const above = sheet.layout.rows[9]!;
    const write = responseRowWrite({
      form,
      answers,
      number: 1,
      preview: false,
      at: AT,
      layout: sheet.layout,
      rowTexts: topRowTexts(sheet),
      usedRows: new Set([total]),
      table: {
        total,
        totalInputs: new Map<string, CellInput>([
          ['cx', { s: 'Total' }],
          ['cy', { f: { t: 'SUM(@0)', r: [{ r1: 'a', c1: 'x', r2: 'b', c2: 'x' }] } }],
          ['cz', { f: { t: 'SUM(@0)', r: [{ r1: 'a', c1: 'x', r2: above, c2: 'x' }] } }],
        ]),
        empty: sheet.layout.rows[0]!,
      },
      rand,
    });
    const onTotal = write.kind === 'title' ? [] : (write.cells ?? []).filter((c) => c.r === total);
    expect(onTotal.map((c) => c.c)).toEqual(['cz']);
  });
});
