import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { sheetJson, sheetServer } from '../testing/sheets';
import {
  sheetAdd,
  sheetGet,
  sheetInsertCols,
  sheetInsertRows,
  sheetLs,
  sheetRmCols,
  sheetRmRows,
  sheetSet,
} from './sheet';

// The sheet verbs (docs/specs/029-sheets/sheet-store.md "Agents"; docs/specs/015-api/cli.md "Commands").
const ONE = 'tab-one-0000';

const costs = () =>
  sheetJson({ id: 'sheet_costs1', tabId: ONE, title: 'Costs' }, [
    ['Item', 'Cost'],
    ['Rent', 1200],
    ['Total', '=SUM(B2:B2)'],
  ]);

function ctxWith(input = '', sheets = [costs()]) {
  const server = sheetServer(DOC_A, sheets);
  const api = fakeApi(
    Object.assign(server.routes, {
      ...library,
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/${ONE}`]: { tab: { id: ONE, elements: [], rev: 2 } },
      [`/documents/${DOC_A}/tabs/${ONE}/changesets`]: { changeset: { id: 'cs', rev: 3 } },
    }),
  );
  const notices: string[] = [];
  const ctx = contextOf(api, [], [], { readInput: async () => input });
  return { ctx: { ...ctx, notice: (l: string) => void notices.push(l) }, server, notices };
}

describe('sheet ls and get', () => {
  it('lists the sheets, one a line', async () => {
    const { ctx } = ctxWith();
    const out = await sheetLs.run!(ctx, sheetLs.input.parse({ doc: DOC_A }));
    expect(sheetLs.text!(out)).toEqual(['Costs  Overview  A1:B3  sheet_costs1']);
    expect(sheetLs.quiet!(out)).toEqual(['sheet_costs1']);
    expect(sheetLs.text!({ sheets: [] })).toEqual(['no sheets']);
  });

  it('says a blank sheet is empty', async () => {
    const { ctx } = ctxWith('', [sheetJson({ id: 'sheet_blank1', tabId: ONE, title: 'Blank' })]);
    const out = await sheetLs.run!(ctx, sheetLs.input.parse({ doc: DOC_A, tab: ONE }));
    expect(sheetLs.text!(out)).toEqual(['Blank  Overview  empty  sheet_blank1']);
  });

  it('prints where a long read stopped', async () => {
    const rows = Array.from({ length: 40 }, () => ['x'.repeat(5_000)]);
    const { ctx } = ctxWith('', [
      sheetJson({ id: 'sheet_long01', tabId: ONE, title: 'Long' }, rows),
    ]);
    const out = await sheetGet.run!(ctx, sheetGet.input.parse({ doc: DOC_A, sheet: 'Long' }));
    expect(out.note).toMatch(/^Stopped at A\d+/);
    expect(sheetGet.text!(out).at(-1)).toBe(out.note);
  });

  it('prints each cell, a formula with what it works out to', async () => {
    const { ctx } = ctxWith();
    const out = await sheetGet.run!(
      ctx,
      sheetGet.input.parse({ doc: DOC_A, sheet: 'Costs', range: 'A2:B3' }),
    );
    expect(sheetGet.text!(out)).toEqual([
      'A2  Rent',
      'B2  1200',
      'A3  Total',
      'B3  =SUM(B2:B2)  → 1200',
    ]);
    expect(sheetGet.quiet!(out)).toEqual(['Rent', '1200', 'Total', '1200']);
    expect(sheetGet.text!({ ...out, cells: [], note: 'Stopped' })).toEqual(['Stopped']);
  });

  it('refuses a sheet it cannot find, with the next command', async () => {
    const { ctx } = ctxWith();
    const refused = sheetGet.run!(ctx, sheetGet.input.parse({ doc: DOC_A, sheet: 'Budget' }));
    await expect(refused).rejects.toBeInstanceOf(VerbRefusal);
    await expect(refused).rejects.toMatchObject({
      status: 404,
      hint: expect.stringContaining('sheet ls'),
    });
  });
});

describe('sheet set', () => {
  it('writes values across a row from a cell, read as typed', async () => {
    const { ctx, server } = ctxWith();
    const out = await sheetSet.run!(
      ctx,
      sheetSet.input.parse({ doc: DOC_A, sheet: 'Costs', at: 'C1', values: ['Yearly', '=B2*12'] }),
    );
    expect(sheetSet.text!(out)).toEqual(['~ sheet "Costs": set C1:D1']);
    expect(sheetSet.quiet!(out)).toEqual(['sheet_costs1']);
    expect(server.writes).toHaveLength(1);
  });

  it('writes the rows of a CSV from stdin', async () => {
    const { ctx } = ctxWith('a,b\n1,2');
    const out = await sheetSet.run!(
      ctx,
      sheetSet.input.parse({ doc: DOC_A, sheet: 'Costs', at: 'A5', values: [], csv: '-' }),
    );
    expect(out.applied).toEqual(['set A5:B6']);
  });

  it('refuses nothing to write, and a formula it cannot read', async () => {
    const { ctx } = ctxWith();
    await expect(
      sheetSet.run!(
        ctx,
        sheetSet.input.parse({ doc: DOC_A, sheet: 'Costs', at: 'A1', values: [] }),
      ),
    ).rejects.toMatchObject({ code: 'usage' });
    await expect(
      sheetSet.run!(
        ctx,
        sheetSet.input.parse({ doc: DOC_A, sheet: 'Costs', at: 'A1', values: ['=('] }),
      ),
    ).rejects.toMatchObject({ code: 'formula_invalid', status: 400 });
  });
});

describe('sheet add', () => {
  it('puts a sheet on a tab, filled from a CSV, and says when it was cut', async () => {
    const wide = Array.from({ length: 205 }, (_, i) => i).join(',');
    const { ctx, notices } = ctxWith(wide);
    const out = await sheetAdd.run!(
      ctx,
      sheetAdd.input.parse({ doc: DOC_A, title: 'Costs', csv: 'wide.csv' }),
    );
    expect(sheetAdd.text!(out)).toEqual([`+ sheet "Costs 2": ${out.filled}`]);
    expect(sheetAdd.quiet!(out)).toEqual([out.sheetId]);
    expect(notices).toEqual(['the CSV was cut at 10,000 rows or 200 columns']);
    expect(sheetAdd.text!({ ...out, filled: null })).toEqual(['+ sheet "Costs 2"']);
  });

  it('puts a blank sheet on the tab named, with no notice', async () => {
    const { ctx, notices } = ctxWith();
    const out = await sheetAdd.run!(ctx, sheetAdd.input.parse({ doc: DOC_A, tab: ONE }));
    expect(out).toMatchObject({ tabId: ONE, title: 'Sheet 1', filled: null });
    expect(notices).toEqual([]);
  });

  it('refuses an unknown tab', async () => {
    const { ctx } = ctxWith();
    await expect(
      sheetAdd.run!(ctx, sheetAdd.input.parse({ doc: DOC_A, tab: 'nope' })),
    ).rejects.toMatchObject({
      code: 'tab_not_found',
    });
  });
});

describe('sheet rows and columns', () => {
  it('inserts and deletes rows and columns by number and letter', async () => {
    const { ctx } = ctxWith();
    const run = async (verb: typeof sheetInsertRows, input: Record<string, unknown>) =>
      verb.text!(
        (await verb.run!(ctx, verb.input.parse({ doc: DOC_A, sheet: 'Costs', ...input }))) as never,
      );
    expect(await run(sheetInsertRows, { where: '2', count: '2', after: true })).toEqual([
      '~ sheet "Costs": inserted 2 rows after row 2',
    ]);
    expect(await run(sheetInsertCols, { where: 'b' })).toEqual([
      '~ sheet "Costs": inserted 1 column before column B',
    ]);
    expect(await run(sheetRmRows, { where: '3:4' })).toEqual(['~ sheet "Costs": deleted rows 3:4']);
    expect(await run(sheetRmCols, { where: 'B' })).toEqual([
      '~ sheet "Costs": deleted columns B:B',
    ]);
    const out = await sheetRmRows.run!(
      ctx,
      sheetRmRows.input.parse({ doc: DOC_A, sheet: 'Costs', where: '9' }),
    );
    expect(sheetRmRows.quiet!(out as never)).toEqual(['sheet_costs1']);
  });

  it('refuses a count that is not 1 to 1000, and a row that is not a number', async () => {
    const { ctx } = ctxWith();
    await expect(
      sheetInsertRows.run!(
        ctx,
        sheetInsertRows.input.parse({ doc: DOC_A, sheet: 'Costs', where: '2', count: '0' }),
      ),
    ).rejects.toMatchObject({ code: 'usage' });
    await expect(
      sheetInsertRows.run!(
        ctx,
        sheetInsertRows.input.parse({ doc: DOC_A, sheet: 'Costs', where: 'two' }),
      ),
    ).rejects.toMatchObject({ code: 'range_invalid' });
  });
});
