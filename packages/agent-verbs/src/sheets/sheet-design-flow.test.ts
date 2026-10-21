// A design and a chart through change_sheet and add_sheet (docs/specs/029-sheets/sheet-store.md "Shaping a sheet",
// "A design"): the cells written through the api, the design tinted for its tab's canvas, the charts added to the tab
// over the Sheet in one changeset with their first read, and a new Sheet made as large as what it holds.
import { describe, expect, it } from 'vitest';
import type { ApiClient } from '@liveplanner/api-client';
import { DOC_A, fakeApi, tabsOfA } from '../testing/fake-api';
import { seeded, sheetJson, sheetServer, type SheetServer } from '../testing/sheets';
import { addSheet } from './add-sheet';
import { changeSheet } from './change-sheet';
import type { SheetDesignInput } from './sheet-design';

const ONE = 'tab-one-0000';
const SHEET_EL = {
  id: 'el-sheet',
  type: 'shape',
  shape: 'plan-sheet',
  x: 100,
  y: 50,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet_blank1' },
};

// A changeset the flow sent, as far as these tests read it.
type SentChangeset = { operations: { op: string; element: Record<string, unknown> }[] };

function setup(
  opts: { background?: string; elements?: unknown[]; changesets?: (r: Request) => Response } = {},
): {
  api: ApiClient;
  server: SheetServer;
  sent: SentChangeset[];
} {
  const server = sheetServer(DOC_A, [
    sheetJson({ id: 'sheet_blank1', tabId: ONE, title: 'Sheet 1' }),
  ]);
  const sent: SentChangeset[] = [];
  const api = fakeApi(
    Object.assign(server.routes, {
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/${ONE}`]: {
        tab: {
          id: ONE,
          opensIn: 'plan',
          elements: opts.elements ?? [SHEET_EL],
          rev: 3,
          ...(opts.background ? { backgroundColor: opts.background } : {}),
        },
      },
      [`/documents/${DOC_A}/tabs/${ONE}/changesets`]: async (r: Request) => {
        if (opts.changesets) return opts.changesets(r);
        sent.push((await r.json()) as SentChangeset);
        return Response.json({ changeset: { id: 'cs', rev: 4 } });
      },
    }),
  );
  return { api, server, sent };
}

const DESIGN: SheetDesignInput = {
  heading: 'Sales',
  blocks: [
    {
      kind: 'table',
      head: ['Region', 'Amount'],
      rows: [
        ['North', 100],
        ['South', 250],
      ],
      total: ['Total', '=SUM(B5:B6)'],
      chart: { type: 'pie' },
    },
  ],
};

describe('a design through change_sheet', () => {
  it('lays the sheet out and adds its chart over the Sheet, with its first read', async () => {
    const { api, sent } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'design', design: DESIGN }] },
      'mcp',
    );
    expect(result.refusal).toBeUndefined();
    expect(result.applied[0]).toMatch(
      /^laid out "Sales" in banded, blue: table "Region…" header A4:B4/,
    );
    expect(result.applied[1]).toBe('placed a chart');
    const [chart] = sent[0]!.operations;
    expect(chart!.element).toMatchObject({
      shape: 'pie-chart',
      chartSource: { sheetId: 'sheet_blank1' },
      chartPalette: 'ocean',
      pieSlices: [
        { label: 'North', value: 100 },
        { label: 'South', value: 250 },
      ],
    });
    // Over the Sheet's top right on the canvas.
    expect(chart!.element).toMatchObject({ x: 100 + 960 - 24 - 420, y: 50 + 120 });
  });

  it('tints a design for a dark canvas', async () => {
    const { api, server } = setup({ background: '#0f172a' });
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'design', design: DESIGN }] },
      'mcp',
    );
    expect(result.refusal).toBeUndefined();
    // The header row in blue's 800, a dark canvas's header, not its 700.
    const fills = server.writes.flatMap((w) =>
      ('cells' in w.write ? (w.write.cells ?? []) : []).map((c) => c.f?.bg),
    );
    expect(fills).toContain('#1e40af');
    expect(fills).not.toContain('#1d4ed8');
  });

  it('charts a range, and says when no Sheet on the tab frames the sheet', async () => {
    const { api, sent } = setup();
    await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Sheet 1',
        changes: [
          {
            op: 'design',
            design: { ...DESIGN, blocks: [{ ...DESIGN.blocks[0]!, chart: undefined } as never] },
          },
        ],
      },
      'mcp',
    );
    const charted = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'chart', type: 'bar', range: 'A4:B6', at: 'E4' }] },
      'mcp',
    );
    expect(charted.applied).toEqual(['charted A4:B6 as a bar chart at E4', 'placed a chart']);
    expect(sent.at(-1)!.operations[0]!.element).toMatchObject({
      shape: 'bar-chart',
      chartVariant: 'horizontal',
    });
    const { api: bare } = setup({ elements: [] });
    const unframed = await changeSheet(
      bare,
      DOC_A,
      {
        sheet: 'Sheet 1',
        changes: [
          {
            op: 'set',
            at: 'A1',
            rows: [
              ['a', 'b'],
              ['x', 1],
            ],
          },
          { op: 'chart', type: 'pie', range: 'A1:B2' },
        ],
      },
      'mcp',
    );
    expect(unframed.applied.at(-1)).toBe(
      'no Sheet on its tab frames the sheet, so its charts were not placed',
    );
  });

  it('stops at a refused design, placing nothing', async () => {
    const { api, sent } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Sheet 1',
        changes: [
          {
            op: 'design',
            design: { heading: 'x', blocks: [{ kind: 'table', head: [], rows: [] }] },
          },
        ],
      },
      'mcp',
    );
    expect(result.refusal).toMatchObject({ code: 'write_invalid' });
    expect(sent).toEqual([]);
  });
});

describe('charts through change_sheet', () => {
  const twoTables: SheetDesignInput = {
    heading: 'Two',
    blocks: [
      { kind: 'table', head: ['A', 'B'], rows: [['x', 1]], chart: { type: 'bar' } },
      {
        kind: 'table',
        head: ['C', 'D'],
        rows: [['y', 2]],
        chart: { type: 'pie', columns: ['C', 'D'] },
      },
    ],
  };

  it('places every chart of a change in one changeset', async () => {
    const { api, sent } = setup();
    const result = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'design', design: twoTables }] },
      'mcp',
    );
    expect(result.applied[0]).toMatch(/; 2 charts$/);
    expect(result.applied[1]).toBe('placed 2 charts');
    expect(sent[0]).toMatchObject({ summary: 'Charts of the sheet' });
    expect(sent[0]!.operations[1]!.element.chartSource).toMatchObject({ cols: expect.any(Array) });
  });

  it('says when the tab refuses its charts, and lets any other failure through', async () => {
    const refused = setup({
      changesets: () => Response.json({ error: 'conflict', message: 'Busy' }, { status: 409 }),
    });
    const result = await changeSheet(
      refused.api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'design', design: DESIGN }] },
      'mcp',
    );
    expect(result.applied).toHaveLength(1);
    expect(result.refusal).toBeDefined();
    const broken = setup({
      changesets: () => {
        throw new Error('network');
      },
    });
    await expect(
      changeSheet(
        broken.api,
        DOC_A,
        { sheet: 'Sheet 1', changes: [{ op: 'design', design: DESIGN }] },
        'mcp',
      ),
    ).rejects.toThrow('network');
  });
});

describe('a sheet’s charts through later changes', () => {
  const CHART = {
    id: 'el-chart',
    type: 'shape',
    shape: 'pie-chart',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    chartSource: { sheetId: 'sheet_blank1', range: { r1: 'x', c1: 'y', r2: 'x', c2: 'y' } },
    sheetAnchor: { x: 250, y: 30 },
  };

  it('keeps a chart on its cell when a column goes in before it, and clears the sheet’s charts', async () => {
    const { api, sent } = setup({ elements: [SHEET_EL, CHART] });
    const two = setup({ elements: [SHEET_EL, CHART, { ...CHART, id: 'el-chart-2' }] });
    const both = await changeSheet(
      two.api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'resize', cols: 'A', px: 200 }] },
      'mcp',
    );
    expect(both.applied[1]).toBe('moved 2 charts back onto the cells they sit on');
    const inserted = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'insert_cols', at: 'A', side: 'before' }] },
      'mcp',
    );
    expect(inserted.applied).toEqual([
      'inserted 1 column before column A',
      'moved a chart back onto the cells it sits on',
    ]);
    expect(sent[0]!.operations).toEqual([
      { op: 'set', target: 'el-chart', fields: { sheetAnchor: { x: 370, y: 30 } } },
    ]);
    const cleared = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'clear_charts' }, { op: 'resize', cols: 'A', px: 300 }] },
      'mcp',
    );
    expect(cleared.applied).toEqual([
      'cleared the sheet’s charts',
      'sized column A to 300 px',
      'removed a chart',
    ]);
    expect(sent[1]!.operations).toEqual([{ op: 'rm', target: 'el-chart' }]);
  });

  it('clears only the charts reading a range, refuses a range it cannot read, and sends nothing with nothing to do', async () => {
    const { api, sent } = setup({ elements: [SHEET_EL, CHART] });
    const none = await changeSheet(
      api,
      DOC_A,
      {
        sheet: 'Sheet 1',
        changes: [
          { op: 'clear_charts', range: 'A1:B2' },
          { op: 'resize', rows: '40', px: 30 },
        ],
      },
      'mcp',
    );
    expect(none.applied[0]).toBe('cleared the charts reading A1:B2');
    expect(sent).toEqual([]);
    const bad = await changeSheet(
      api,
      DOC_A,
      { sheet: 'Sheet 1', changes: [{ op: 'clear_charts', range: '??' }] },
      'mcp',
    );
    expect(bad.refusal).toMatchObject({ code: 'range_invalid' });
  });
});

describe('a design through add_sheet', () => {
  it('makes a Sheet as large as its cells, with its charts in the same changeset', async () => {
    const { api, sent } = setup();
    const wide: SheetDesignInput = {
      heading: 'Wide',
      widths: Array.from({ length: 10 }, () => 200),
      blocks: [
        {
          kind: 'table',
          head: Array.from({ length: 10 }, (_, i) => `C${i}`),
          rows: [Array.from({ length: 10 }, (_, i) => i)],
          chart: { type: 'line' },
        },
      ],
    };
    const result = await addSheet(
      api,
      DOC_A,
      { tabId: ONE, title: 'Wide', design: wide },
      'mcp',
      seeded(4),
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.laidOut).toMatch(/^laid out "Wide"/);
    expect(result.filled).toBe('A1:J5');
    const ops = sent[0]!.operations;
    expect(ops.map((o) => o.element.shape)).toEqual(['plan-sheet', 'line-chart']);
    // Ten columns of 200 px and one more, past its row numbers, is past the largest a new Sheet is made.
    expect(ops[0]!.element.width).toBe(1800);
    expect(ops[1]!.element).toMatchObject({ chartSource: { sheetId: result.sheetId } });
  });

  it('refuses a design it cannot lay out, making no sheet', async () => {
    const { api } = setup();
    expect(
      await addSheet(
        api,
        DOC_A,
        { design: { heading: 'x', blocks: [{ kind: 'table', head: ['a'], rows: [['=(']] }] } },
        'mcp',
      ),
    ).toMatchObject({ ok: false, code: 'formula_invalid' });
  });
});
