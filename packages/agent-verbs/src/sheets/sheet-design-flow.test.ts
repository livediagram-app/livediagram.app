// A design and a chart through change_sheet and add_sheet (docs/specs/029-sheets/sheet-store.md "Shaping a sheet",
// "A design"): the cells written through the api, the design tinted for its tab's canvas, the charts added to the tab
// over the Sheet in one changeset with their first read, and a new Sheet made as large as what it holds.
import { describe, expect, it } from 'vitest';
import type { ApiClient } from '@livediagram/api-client';
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

function setup(opts: { background?: string; elements?: unknown[] } = {}): {
  api: ApiClient;
  server: SheetServer;
  sent: { operations: { op: string; element: Record<string, unknown> }[] }[];
} {
  const server = sheetServer(DOC_A, [
    sheetJson({ id: 'sheet_blank1', tabId: ONE, title: 'Sheet 1' }),
  ]);
  const sent: { operations: { op: string; element: Record<string, unknown> }[] }[] = [];
  const api = fakeApi(
    Object.assign(server.routes, {
      ...tabsOfA,
      [`/documents/${DOC_A}/tabs/${ONE}`]: {
        tab: {
          id: ONE,
          elements: opts.elements ?? [SHEET_EL],
          rev: 3,
          ...(opts.background ? { backgroundColor: opts.background } : {}),
        },
      },
      [`/documents/${DOC_A}/tabs/${ONE}/changesets`]: async (r: Request) => {
        sent.push(await r.json());
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
    // Ten columns of 200 px and one more, past its row numbers.
    expect(ops[0]!.element.width).toBe(46 + 10 * 200 > 1800 ? 1800 : 46 + 10 * 200);
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
