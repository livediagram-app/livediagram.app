import { describe, expect, it } from 'vitest';
import type { ApiClient } from '@livediagram/api-client';
import { PLACED_BOARD_GAP } from '@livediagram/items';
import { DOCUMENT_CELLS_MAX, SHEET_WRITE_CELLS_MAX } from '@livediagram/sheets';
import { DOC_A, fakeApi, tabsOfA } from '../testing/fake-api';
import { seeded, sheetJson, sheetServer, type SheetServer } from '../testing/sheets';
import { addSheet } from './add-sheet';
import { changeSheet } from './change-sheet';
import { formatPatchOf } from './sheet-change-build';
import { listSheets } from './sheet-listing';
import { readSheet, SHEET_READ_CHARS_MAX, type SheetRead } from './read-sheet';
import { resolveSheet, type SheetRefusal } from './sheet-state';

// The sheet engine agents share (docs/specs/029-sheets/sheet-store.md "Agents"): sheets by title, cells by A1,
// values by the editor's engine, writes through the api's write route.
const ONE = 'tab-one-0000';
const TWO = 'tab-two-0000';
const SHEET_EL = {
  id: 'el-sheet',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet_costs1' },
};

function costs() {
  return sheetJson({ id: 'sheet_costs1', tabId: ONE, title: 'Costs' }, [
    ['Item', 'Cost'],
    ['Rent', 1200],
    ['Power', 300],
    ['Total', '=SUM(B2:B3)'],
  ]);
}
const notes = () =>
  sheetJson({ id: 'sheet_notes1', tabId: TWO, title: 'Notes', createdAt: 1 }, [['hello']]);

function setup(
  sheets = [costs(), notes()],
  opts: { refuse?: string; status?: number; refuseAfter?: number } = {},
): { api: ApiClient; server: SheetServer; sent: unknown[] } {
  const server = sheetServer(DOC_A, sheets, opts);
  const sent: unknown[] = [];
  const api = fakeApi(
    Object.assign(server.routes, {
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/${ONE}`]: { tab: { id: ONE, elements: [SHEET_EL], rev: 3 } },
      [`/documents/${DOC_A}/tabs/${TWO}`]: { tab: { id: TWO, elements: [], rev: 1 } },
      [`/documents/${DOC_A}/tabs/${TWO}/changesets`]: { changeset: null },
      [`/documents/${DOC_A}/tabs/${ONE}/changesets`]: async (r: Request) => {
        sent.push(await r.json());
        return Response.json({ changeset: { id: 'cs', rev: 4 } });
      },
      [`/documents/${DOC_A}/items`]: {
        items: [1, 2].map((key) => ({
          id: `item${key}aaaa`,
          type: 'task',
          key,
          rank: `i${key}`,
          fields: { title: `Card ${key}`, status: 'todo' },
          rev: 1,
          createdAt: 1,
          updatedAt: 1,
          createdBy: { id: 'p', name: 'P', color: '#000000' },
          updatedBy: { id: 'p', name: 'P', color: '#000000' },
        })),
        rev: 1,
      },
    }),
  );
  return { api, server, sent };
}

const read = async (api: ApiClient, sheet: string, range?: string) =>
  (await readSheet(api, DOC_A, { sheet, ...(range ? { range } : {}) })) as SheetRead;

const valueAt = (r: SheetRead, at: string) => r.cells.find((c) => c.at === at)?.value;

describe('naming a sheet', () => {
  const sheets = [costs(), notes(), sheetJson({ id: 'sheet_costs2', tabId: TWO, title: 'costs' })];

  it('takes an id, an id prefix, or a title one tab has', () => {
    expect(resolveSheet(sheets, 'sheet_notes1')).toMatchObject({
      ok: true,
      sheet: { title: 'Notes' },
    });
    expect(resolveSheet(sheets, 'NOTES')).toMatchObject({
      ok: true,
      sheet: { id: 'sheet_notes1' },
    });
    expect(resolveSheet(sheets, 'sheet_n')).toMatchObject({
      ok: true,
      sheet: { id: 'sheet_notes1' },
    });
  });

  it('refuses a title two tabs share, an unknown name, and a document with none', () => {
    expect(resolveSheet(sheets, 'Costs')).toMatchObject({ ok: false, code: 'sheet_ambiguous' });
    const unknown = resolveSheet(sheets, 'Budget') as SheetRefusal;
    expect(unknown.message).toContain('"Notes" (sheet_notes1)');
    expect(resolveSheet([], 'x')).toMatchObject({ code: 'sheet_not_found' });
    // Too short to be an id prefix.
    expect(resolveSheet(sheets, 'she')).toMatchObject({ code: 'sheet_not_found' });
  });
});

describe('listing sheets', () => {
  it('lists each sheet with its tab, the range in use, and the element framing it', async () => {
    const { api } = setup();
    expect(await listSheets(api, DOC_A)).toEqual({
      sheets: [
        {
          id: 'sheet_costs1',
          title: 'Costs',
          tabId: ONE,
          tabName: 'Overview',
          rows: 4,
          cols: 2,
          filled: 'A1:B4',
          elementId: 'el-sheet',
        },
        {
          id: 'sheet_notes1',
          title: 'Notes',
          tabId: TWO,
          tabName: 'Details',
          rows: 1,
          cols: 1,
          filled: 'A1',
          elementId: null,
        },
      ],
    });
  });

  it('lists one tab, and says an empty sheet fills nothing', async () => {
    const { api } = setup([sheetJson({ id: 'sheet_blank1', tabId: TWO, title: 'Blank' })]);
    const { sheets } = await listSheets(api, DOC_A, TWO);
    expect(sheets.map((s) => [s.title, s.filled])).toEqual([['Blank', null]]);
  });

  it('lists a sheet on a tab the document no longer names, its tab unread, ordered as the tabs', async () => {
    const { api, server } = setup([
      notes(),
      sheetJson({ id: 'sheet_gone02', tabId: 'tab-gone', title: 'B' }),
      costs(),
      sheetJson({ id: 'sheet_gone01', tabId: 'tab-gone', title: 'A' }),
    ]);
    // Only the Sheet element frames a sheet, not the tab's other elements.
    server.routes[`/documents/${DOC_A}/tabs/${ONE}`] = {
      tab: {
        id: ONE,
        elements: [{ id: 'el-box', type: 'shape', shape: 'rect' }, SHEET_EL],
        rev: 3,
      },
    };
    // A tab with no order reads as the first.
    server.routes[`/documents/${DOC_A}`] = {
      document: {
        id: DOC_A,
        name: 'Auth flow',
        tabs: [
          { id: TWO, name: 'Details', orderIndex: 1 },
          { id: ONE, name: 'Overview' },
        ],
      },
    };
    const { sheets } = await listSheets(api, DOC_A);
    expect(sheets.map((s) => [s.title, s.tabName, s.elementId])).toEqual([
      ['A', 'tab-gone', null],
      ['B', 'tab-gone', null],
      ['Costs', 'Overview', 'el-sheet'],
      ['Notes', 'Details', null],
    ]);
  });
});

describe('reading a sheet', () => {
  it('answers the non-empty cells of the range in use, inputs as typed and values worked out', async () => {
    const { api } = setup();
    const r = await read(api, 'Costs');
    expect(r).toMatchObject({
      range: 'A1:B4',
      rows: 4,
      cols: 2,
      truncated: false,
      frozen: { rows: 0, cols: 0 },
    });
    expect(r.cells).toContainEqual({
      at: 'B4',
      input: '=SUM(B2:B3)',
      value: 1500,
      display: '1500',
    });
    expect(r.cells.map((c) => c.at)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']);
    expect(r).not.toHaveProperty('note');
  });

  it('reads a range, and refuses one that is not A1', async () => {
    const { api } = setup();
    expect((await read(api, 'Costs', 'b2:b3')).cells.map((c) => c.value)).toEqual([1200, 300]);
    expect(await readSheet(api, DOC_A, { sheet: 'Costs', range: 'nope' })).toMatchObject({
      ok: false,
      code: 'range_invalid',
    });
    expect(await readSheet(api, DOC_A, { sheet: 'Budget' })).toMatchObject({
      code: 'sheet_not_found',
    });
  });

  it('answers a spilled cell with no input, and the merges and filter in A1', async () => {
    const sheet = sheetJson({ id: 'sheet_spill1', tabId: ONE, title: 'Spill' }, [
      ['=SEQUENCE(3)', 'x'],
    ]);
    const [r1, r2, r3] = sheet.layout.rows;
    const [c1, c2] = sheet.layout.cols;
    sheet.layout = {
      ...sheet.layout,
      // The second merge's rows are gone, so it is left out.
      merges: [
        { r1: r3!, c1: c1!, r2: r3!, c2: c2! },
        { r1: 'gone', c1: c1!, r2: 'gone', c2: c1! },
      ],
      filter: { r1: r1!, c1: c1!, r2: r2!, c2: c2!, conds: {} },
    };
    const { api } = setup([sheet]);
    // The range in use ends at the last input, so the spill is read by range.
    const r = await read(api, 'Spill', 'A1:B3');
    expect(r.cells).toContainEqual({ at: 'A2', input: '', value: 2, display: '2' });
    expect(r).toMatchObject({ merges: ['A3:B3'], filter: 'A1:B2' });
  });

  it('works out card functions from the document’s items', async () => {
    const { api } = setup([
      sheetJson({ id: 'sheet_cards1', tabId: ONE, title: 'Cards' }, [['=CARDCOUNT()']]),
    ]);
    expect(valueAt(await read(api, 'Cards'), 'A1')).toBe(2);
  });

  it('stops at the cells one read answers with, and says where to read on', async () => {
    // Mostly empty, so the cells cap stops it before the characters cap.
    const rows = Array.from({ length: 3000 }, (_, i) =>
      i === 0 || i === 2999 ? [i, i * 2] : [null, null],
    );
    const { api } = setup([sheetJson({ id: 'sheet_big001', tabId: ONE, title: 'Big' }, rows)]);
    const r = await read(api, 'Big');
    expect(r.truncated).toBe(true);
    expect(r.range).toBe('A1:B2500');
    expect(r.note).toContain('read on with a range from row 2501');
  });

  it('stops at the characters one read answers with', async () => {
    const rows = Array.from({ length: 40 }, () => ['x'.repeat(5_000)]);
    const { api } = setup([sheetJson({ id: 'sheet_long01', tabId: ONE, title: 'Long' }, rows)]);
    const r = await read(api, 'Long');
    expect(JSON.stringify(r.cells).length).toBeLessThanOrEqual(SHEET_READ_CHARS_MAX);
    expect(r.truncated).toBe(true);
    expect(r.note).toMatch(/^Stopped at A\d+/);
  });
});

describe('changing a sheet', () => {
  it('applies changes in order, each against the sheet the last left, through the write route', async () => {
    const { api, server } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'costs',
        changes: [
          { op: 'insert_rows', at: 2, count: 1 },
          { op: 'set', at: 'A2', rows: [['Water', 50]] },
          {
            op: 'format',
            range: 'B2:B5',
            format: { bold: true, numberFormat: 'currency', currency: '£' },
          },
          { op: 'freeze', rows: 1 },
          { op: 'rename', title: 'Budget' },
        ],
      },
      'mcp',
    );
    // The fixture's fill was rev 1; five writes later, rev 6.
    expect(result).toMatchObject({ sheetId: 'sheet_costs1', title: 'Budget', rev: 6 });
    expect(server.writes).toHaveLength(5);
    expect(result.applied).toEqual([
      'inserted 1 row before row 2',
      'set A2:B2',
      'formatted B2:B5',
      'froze 1 row',
      'renamed to "Budget"',
    ]);
    expect(server.writes.every((w) => typeof w.wid === 'string')).toBe(true);
    const r = await read(api, 'Budget');
    // The inserted row moved Rent down; the total still reads the cells it read, and now shows pounds.
    expect(r.cells.find((c) => c.at === 'B5')).toMatchObject({
      input: '=SUM(B3:B4)',
      value: 1500,
      display: '£1,500.00',
    });
    expect(r.frozen).toEqual({ rows: 1, cols: 0 });
  });

  it('says which rows and columns a delete took, not the span asked for', async () => {
    const { api } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'delete_rows', rows: '4' },
          // The sheet has 100 rows: a span past them deletes as far as they go.
          { op: 'delete_rows', rows: '50:500' },
          { op: 'delete_cols', cols: 'C:D' },
        ],
      },
      'mcp',
    );
    expect(result.applied).toEqual(['deleted row 4', 'deleted rows 50:99', 'deleted columns C:D']);
  });

  it('sorts, clears and deletes', async () => {
    const { api } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'sort', by: 'B', range: 'A1:B3', header: true },
          { op: 'clear', range: 'A4:B4' },
          { op: 'insert_cols', at: 'B', side: 'after', count: 2 },
          { op: 'delete_cols', cols: 'C:D' },
          { op: 'delete_rows', rows: '4' },
        ],
      },
      'cli',
    );
    expect(result.refusal).toBeUndefined();
    const r = await read(api, 'Costs');
    expect(r.cells.map((c) => c.value)).toEqual(['Item', 'Cost', 'Power', 300, 'Rent', 1200]);
  });

  it('refuses a formula it cannot read, naming the cell, before writing anything', async () => {
    const { api, server } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Costs', changes: [{ op: 'set', at: 'C1', rows: [[1, '=SUM(']] }] },
      'mcp',
    );
    expect(result.refusal?.code).toBe('formula_invalid');
    expect(result.refusal?.message).toMatch(/^The formula in D1 cannot be read/);
    expect(server.writes).toEqual([]);
  });

  it('says what went through before a refusal, the api’s in words', async () => {
    const { api } = setup(undefined, { refuse: 'sheet_full' });
    const full = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Costs', changes: [{ op: 'set', at: 'A9', rows: [['x']] }] },
      'mcp',
    );
    expect(full.refusal).toEqual({
      code: 'sheet_full',
      message: expect.stringContaining('holds the most cells'),
    });
    const { api: ok } = setup();
    const partly = await changeSheet(
      ok,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'freeze', cols: 1 },
          { op: 'delete_rows', rows: '200' },
        ],
      },
      'mcp',
    );
    expect(partly.applied).toEqual(['froze 1 column']);
    expect(partly.refusal?.code).toBe('range_invalid');
  });

  it('lets an api failure that is not a refusal throw', async () => {
    const { api } = setup(undefined, { refuse: 'boom', status: 500 });
    await expect(
      changeSheet(api, DOC_A, { sheet: 'Costs', changes: [{ op: 'freeze', rows: 1 }] }, 'mcp'),
    ).rejects.toThrow();
  });

  it('refuses past the sheet’s columns, and deleting its last column', async () => {
    const { api } = setup();
    const wide = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'insert_cols', at: 'A', count: 500 },
          { op: 'insert_cols', at: 'A' },
        ],
      },
      'mcp',
    );
    // 26 columns new, so room for 174 more.
    expect(wide.applied).toEqual(['inserted 174 columns before column A']);
    expect(wide.refusal?.code).toBe('sheet_too_large');
    const { api: narrow } = setup();
    const last = await changeSheet(
      narrow,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'delete_cols', cols: 'A:Z' },
          { op: 'delete_cols', cols: 'A' },
        ],
      },
      'mcp',
    );
    // Asked for A:Z of 26 columns: one always stays, so the line names the 25 deleted.
    expect(last.applied).toEqual(['deleted columns A:Y; column Z stays, as a sheet keeps one']);
    expect(last.refusal).toEqual({
      code: 'range_invalid',
      message: 'A sheet keeps at least one row and one column.',
    });
  });

  it('sends nothing for a sort with nothing to move', async () => {
    const { api, server } = setup();
    const range = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Costs', changes: [{ op: 'sort', by: 'B', range: 'A2:B3', descending: true }] },
      'mcp',
    );
    expect(range).toMatchObject({ applied: ['sorted A2:B3 by column B, Z to A'], rev: null });
    // One row in use: nothing to reorder.
    const whole = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Notes', changes: [{ op: 'sort', by: 'A' }] },
      'mcp',
    );
    expect(whole).toMatchObject({ applied: ['sorted the sheet by column A, A to Z'], rev: null });
    expect(server.writes).toEqual([]);
  });

  it('clears inputs only, and says when a set was cut at the sheet’s edge', async () => {
    const { api } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [
          { op: 'clear', range: 'A4', what: 'inputs' },
          { op: 'set', at: 'A6', rows: [Array.from({ length: 205 }, (_, i) => i)] },
        ],
      },
      'mcp',
    );
    expect(result.applied[0]).toBe('cleared inputs of A4');
    expect(result.applied[1]).toMatch(
      /^set A6:\w+6 \(cut at the sheet’s 10,000 rows or 200 columns\)$/,
    );
  });

  it.each([
    [{ op: 'set', at: 'nope', rows: [[1]] }, 'range_invalid'],
    [{ op: 'format', range: 'nope', format: { bold: true } }, 'range_invalid'],
    [{ op: 'delete_rows', rows: 'x' }, 'range_invalid'],
    [{ op: 'sort', by: 'A', range: 'nope' }, 'range_invalid'],
    [{ op: 'rename', title: 'Notes 2' }, 'sheet_title_taken'],
    [{ op: 'rename', title: ' ' }, 'title_invalid'],
    [{ op: 'format', range: 'A1', format: { color: 'red' } }, 'format_invalid'],
    [{ op: 'format', range: 'A1', format: {} }, 'format_invalid'],
    [{ op: 'clear', range: 'A0' }, 'range_invalid'],
    [{ op: 'insert_cols', at: 'ZZZ' }, 'range_invalid'],
    [{ op: 'insert_rows', at: 500 }, 'range_invalid'],
    [{ op: 'delete_cols', cols: 'A:B:C' }, 'range_invalid'],
    [{ op: 'sort', by: '?' }, 'range_invalid'],
    [{ op: 'sort', by: 'A', range: 'B1:C3' }, 'range_invalid'],
    [{ op: 'freeze' }, 'write_invalid'],
  ] as const)('refuses %o with %s', async (change, code) => {
    const twin = sheetJson({ id: 'sheet_notes2', tabId: ONE, title: 'Notes 2' });
    const { api } = setup([costs(), twin]);
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Costs', changes: [change as never] },
      'mcp',
    );
    expect(result.refusal?.code).toBe(code);
  });

  it('sorts a whole sheet by reordering its rows', async () => {
    const { api } = setup([
      sheetJson({ id: 'sheet_nums01', tabId: ONE, title: 'Nums' }, [[3], [1], [2]]),
    ]);
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Nums', changes: [{ op: 'sort', by: 'A', descending: true }] },
      'mcp',
    );
    expect(result.applied).toEqual(['sorted the sheet by column A, Z to A']);
    expect((await read(api, 'Nums')).cells.map((c) => c.value)).toEqual([3, 2, 1]);
  });

  it('refuses a sheet it cannot find', async () => {
    const { api } = setup();
    expect(
      (await changeSheet(api, DOC_A, { sheet: 'Nope', changes: [] }, 'mcp')).refusal?.code,
    ).toBe('sheet_not_found');
  });

  it('maps formats in words to the engine’s keys', () => {
    expect(
      formatPatchOf({
        bold: false,
        align: 'center',
        wrap: 'clip',
        verticalAlign: null,
        background: '#FFAA00',
      }),
    ).toEqual({
      b: null,
      ha: 'c',
      wr: 'c',
      va: null,
      bg: '#ffaa00',
    });
    expect(formatPatchOf({ fontSize: 15 })).toEqual({ fs: 15 });
    expect(formatPatchOf({ fontSize: 97 })).toBeNull();
  });
});

describe('adding a sheet', () => {
  it('makes the sheet, fills it from CSV, and places its element beside the tab’s content', async () => {
    const { api, server, sent } = setup();
    const result = await addSheet(
      api,
      DOC_A,
      { title: 'Costs', csv: 'a,b\n1,=A2*2' },
      'mcp',
      seeded(3),
    );
    expect(result).toMatchObject({
      ok: true,
      tabId: ONE,
      title: 'Costs 2',
      filled: 'A1:B2',
      truncated: false,
    });
    if (!result.ok) return;
    expect(server.creates).toEqual([
      expect.objectContaining({ id: result.sheetId, tabId: ONE, title: 'Costs 2' }),
    ]);
    expect(sent[0]).toMatchObject({
      operations: [
        {
          op: 'add',
          element: {
            id: result.elementId,
            shape: 'plan-sheet',
            x: 960 + PLACED_BOARD_GAP,
            y: 0,
            width: 960,
            height: 560,
            planSheet: { sheetId: result.sheetId },
          },
        },
      ],
      base: { rev: 3 },
    });
    expect(valueAt(await read(api, result.sheetId), 'B2')).toBe(2);
  });

  it('names a blank one Sheet n on the tab asked for', async () => {
    const { api, server } = setup();
    const result = await addSheet(api, DOC_A, { tabId: TWO, rows: [] }, 'cli');
    expect(result).toMatchObject({ ok: true, tabId: TWO, title: 'Sheet 1', filled: null });
    expect(server.writes).toEqual([]);
    // An empty CSV fills nothing either.
    expect(await addSheet(api, DOC_A, { tabId: TWO, csv: '' }, 'cli')).toMatchObject({
      ok: true,
      filled: null,
      truncated: false,
    });
  });

  it('takes the first tab holding a sheet, tabs with no order kept as listed', async () => {
    const { api, server } = setup();
    server.routes[`/documents/${DOC_A}`] = {
      document: {
        id: DOC_A,
        name: 'Auth flow',
        tabs: [
          { id: TWO, name: 'Details' },
          { id: ONE, name: 'Overview' },
        ],
      },
    };
    expect(await addSheet(api, DOC_A, {}, 'mcp')).toMatchObject({
      ok: true,
      tabId: TWO,
      title: 'Sheet 1',
      changesetId: null,
    });
  });

  it('refuses a document with no tabs, and lets an api failure that is not a refusal throw', async () => {
    const { api, server } = setup();
    server.routes[`/documents/${DOC_A}`] = { document: { id: DOC_A, name: 'Empty', tabs: [] } };
    expect(await addSheet(api, DOC_A, {}, 'mcp')).toEqual({
      ok: false,
      code: 'tab_not_found',
      message: 'That document has no tabs.',
    });
    server.routes[`/documents/${DOC_A}`] = () => Response.json({ error: 'boom' }, { status: 500 });
    await expect(addSheet(api, DOC_A, {}, 'mcp')).rejects.toThrow();
  });

  it('refuses an unknown tab, and a formula it cannot read before making anything', async () => {
    const { api, server } = setup();
    expect(await addSheet(api, DOC_A, { tabId: 'nope' }, 'mcp')).toMatchObject({
      code: 'tab_not_found',
    });
    expect(await addSheet(api, DOC_A, { rows: [['=(']] }, 'mcp')).toMatchObject({
      code: 'formula_invalid',
    });
    expect(server.creates).toEqual([]);
  });

  it('answers an api refusal in words', async () => {
    const server = sheetServer(DOC_A, []);
    const api = fakeApi(
      Object.assign(server.routes, {
        ...tabsOfA,
        [`/documents/${DOC_A}/sheets`]: (r: Request) =>
          r.method === 'POST'
            ? Response.json({ error: 'sheets_full' }, { status: 413 })
            : Response.json({ sheets: [] }),
      }),
    );
    expect(await addSheet(api, DOC_A, {}, 'mcp')).toMatchObject({ ok: false, code: 'sheets_full' });
  });

  it('fills a sheet on the tab asked for, counting the document’s cells first', async () => {
    const { api, server } = setup();
    const result = await addSheet(api, DOC_A, { tabId: TWO, rows: [['a', 1]] }, 'cli', seeded(7));
    expect(result).toMatchObject({ ok: true, tabId: TWO, title: 'Sheet 1', filled: 'A1:B1' });
    expect(server.writes).toHaveLength(1);
  });
});

// A change goes to the api in parts of at most 5,000 cells, each checked on its own there; checked whole here first,
// so a later part's refusal cannot leave half a change stored and reported as nothing
// (docs/specs/029-sheets/sheet-store.md "Agents").
describe('changes larger than one write', () => {
  const grid = (rows: number, cols: number) =>
    Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r * cols + c));
  // A sheet on the other tab holding most of the document's cell budget.
  const crowded = (cells: number) => ({
    ...notes(),
    cells: Array.from({ length: cells }, (_, i) => ({ r: `r${i}`, c: 'c0' })),
  });

  it('refuses a change that would pass the document’s cells, before writing any part', async () => {
    const { api, server } = setup([costs(), crowded(DOCUMENT_CELLS_MAX - 10)]);
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Costs', changes: [{ op: 'set', at: 'A10', rows: grid(1, 20) }] },
      'mcp',
    );
    expect(result.refusal).toEqual({
      code: 'sheets_full',
      message: expect.stringContaining('none of it was written'),
    });
    expect(server.writes).toEqual([]);
  });

  it('says how much of a change landed when a later part is still refused', async () => {
    const { api, server } = setup(undefined, { refuse: 'sheet_busy', refuseAfter: 1 });
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Costs',
        changes: [{ op: 'set', at: 'A10', rows: grid(300, 20) }],
      },
      'mcp',
    );
    expect(server.writes).toHaveLength(2);
    expect(result.applied).toEqual([
      `partly set A10:T309: ${SHEET_WRITE_CELLS_MAX} of its 6000 cells landed before the refusal`,
    ]);
    expect(result.refusal?.code).toBe('sheet_busy');
    expect(result.rev).toBe(2);
  });

  it('add_sheet refuses first cells past the document’s cells without making a sheet', async () => {
    const { api, server } = setup([costs(), crowded(DOCUMENT_CELLS_MAX - 10)]);
    expect(await addSheet(api, DOC_A, { tabId: TWO, rows: grid(1, 20) }, 'mcp')).toMatchObject({
      ok: false,
      code: 'sheets_full',
    });
    expect(server.creates).toEqual([]);
  });

  it('add_sheet deletes the sheet it made when filling it fails, and places nothing', async () => {
    const { api, server, sent } = setup(undefined, { refuse: 'sheet_busy', refuseAfter: 1 });
    const result = await addSheet(api, DOC_A, { rows: grid(300, 20) }, 'mcp', seeded(5));
    expect(result).toMatchObject({ ok: false, code: 'sheet_busy' });
    expect(server.creates).toHaveLength(1);
    expect(server.deletes).toEqual([(server.creates[0] as { id: string }).id]);
    expect(sent).toEqual([]);
  });

  it('add_sheet deletes the sheet it made when placing it is refused', async () => {
    const { api, server } = setup();
    server.routes[`/documents/${DOC_A}/tabs/${ONE}/changesets`] = () =>
      Response.json({ error: 'conflict' }, { status: 409 });
    await expect(addSheet(api, DOC_A, { rows: [['a']] }, 'mcp')).resolves.toMatchObject({
      ok: false,
    });
    expect(server.deletes).toEqual([(server.creates[0] as { id: string }).id]);
  });

  it('add_sheet still answers the placing refusal when deleting the sheet it made fails', async () => {
    const { api, server } = setup();
    server.routes[`/documents/${DOC_A}/tabs/${ONE}/changesets`] = () =>
      Response.json({ error: 'conflict' }, { status: 409 });
    const offline: ApiClient = {
      ...api,
      fetch: (path, init) =>
        init?.method === 'DELETE'
          ? Promise.reject(new TypeError('offline'))
          : api.fetch(path, init),
    };
    expect(await addSheet(offline, DOC_A, { rows: [['a']] }, 'mcp')).toMatchObject({
      ok: false,
      code: 'conflict',
    });
    expect(server.creates).toHaveLength(1);
    expect(server.deletes).toEqual([]);
  });

  it('add_sheet keeps the sheet it made when placing it never answered, since its element may have landed', async () => {
    const { api, server } = setup();
    server.routes[`/documents/${DOC_A}/tabs/${ONE}/changesets`] = () => {
      throw new TypeError('network down');
    };
    await expect(addSheet(api, DOC_A, { rows: [['a']] }, 'mcp')).rejects.toThrow('network down');
    expect(server.creates).toHaveLength(1);
    expect(server.deletes).toEqual([]);
  });
});
