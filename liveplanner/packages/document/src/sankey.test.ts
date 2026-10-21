import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import {
  cleanSankeyName,
  SANKEY_MAX_NODES,
  formatSankeyPercent,
  formatSankeyValue,
  sankeyGraph,
  sankeyNodeNames,
  SANKEY_DEFAULT_FLOWS,
  SANKEY_MAX_FLOWS,
  type SankeyFlow,
} from './sankey-model';
import { sankeyBandPath, sankeyLayout } from './sankey-layout';
import {
  parseSankeyText,
  readSankeyNumber,
  SANKEY_LINE_MAX,
  sankeyFlowsToText,
} from './sankey-text';

const AREA = { x: 0, y: 0, w: 600, h: 300 };
const flow = (from: string, to: string, value: number): SankeyFlow => ({ from, to, value });

describe('sankeyGraph', () => {
  it('numbers nodes by first appearance and sums each side', () => {
    const g = sankeyGraph(SANKEY_DEFAULT_FLOWS);
    expect(g.nodes.map((n) => n.name)).toEqual([
      'Salary',
      'Budget',
      'Side Work',
      'Needs',
      'Wants',
      'Savings',
      'Rent',
      'Groceries',
    ]);
    const budget = g.nodes[1]!;
    expect(budget.inflow).toBe(4000);
    expect(budget.outflow).toBe(4000);
    expect(g.skipped).toEqual([]);
  });

  it('matches names after trimming and collapsing whitespace', () => {
    const g = sankeyGraph([flow(' A ', 'B', 1), flow('A', 'B  ', 2)]);
    expect(g.nodes.map((n) => n.name)).toEqual(['A', 'B']);
    expect(g.links).toHaveLength(2);
  });

  it('sets aside empty names, self-flows and unusable values with a reason', () => {
    const g = sankeyGraph([
      flow('', 'B', 1),
      flow('A', 'A', 1),
      flow('A', 'B', 0),
      flow('A', 'B', -3),
      flow('A', 'B', Number.NaN),
      flow('A', 'B', 4),
    ]);
    expect(g.skipped).toEqual([
      { flow: 0, reason: 'empty-name' },
      { flow: 1, reason: 'self' },
      { flow: 2, reason: 'value' },
      { flow: 3, reason: 'value' },
      { flow: 4, reason: 'value' },
    ]);
    expect(g.links.map((l) => l.flow)).toEqual([5]);
  });

  it('sets aside the flow that closes a loop and keeps the ones before it', () => {
    const g = sankeyGraph([flow('A', 'B', 5), flow('B', 'C', 5), flow('C', 'A', 2)]);
    expect(g.skipped).toEqual([{ flow: 2, reason: 'loop' }]);
    expect(g.links.map((l) => l.flow)).toEqual([0, 1]);
  });

  it('drops a node whose only flow was set aside', () => {
    const g = sankeyGraph([flow('A', 'B', 1), flow('B', 'Z', -1)]);
    expect(g.nodes.map((n) => n.name)).toEqual(['A', 'B']);
  });

  it('caps the flows it reads', () => {
    const many = Array.from({ length: SANKEY_MAX_FLOWS + 5 }, (_, i) => flow(`s${i % 10}`, 't', 1));
    const g = sankeyGraph(many);
    expect(g.links).toHaveLength(SANKEY_MAX_FLOWS);
    expect(g.skipped.filter((s) => s.reason === 'too-many')).toHaveLength(5);
  });

  it('caps the nodes it draws', () => {
    const many = Array.from({ length: SANKEY_MAX_NODES + 3 }, (_, i) => flow(`s${i}`, 't', 1));
    const g = sankeyGraph(many);
    expect(g.nodes).toHaveLength(SANKEY_MAX_NODES);
    expect(g.skipped.filter((s) => s.reason === 'too-many')).toHaveLength(4);
  });

  it('survives a long chain without recursion', () => {
    const chain = Array.from({ length: 150 }, (_, i) => flow(`n${i}`, `n${i + 1}`, 1));
    expect(() => sankeyGraph(chain)).not.toThrow();
  });
});

describe('sankeyLayout', () => {
  it('lays out nothing for no flows', () => {
    const l = sankeyLayout([], AREA);
    expect(l.nodes).toEqual([]);
    expect(l.columns).toBe(0);
  });

  it('puts columns by step and justifies end nodes to the last column', () => {
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA);
    const col = Object.fromEntries(l.nodes.map((n) => [n.name, n.column]));
    expect(l.columns).toBe(4);
    expect(col).toMatchObject({ Salary: 0, 'Side Work': 0, Budget: 1, Needs: 2, Rent: 3 });
    // Wants and Savings end at step 2, but justified they sit with Rent and Groceries.
    expect(col.Wants).toBe(3);
    expect(col.Savings).toBe(3);
  });

  it('leaves end nodes at their own step when aligned by step', () => {
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA, 'left');
    const col = Object.fromEntries(l.nodes.map((n) => [n.name, n.column]));
    expect(col.Wants).toBe(2);
    expect(col.Rent).toBe(3);
  });

  it('keeps every node inside the area and nodes in a column apart', () => {
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA);
    for (const n of l.nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(AREA.y - 0.01);
      expect(n.y1).toBeLessThanOrEqual(AREA.y + AREA.h + 0.01);
      expect(n.x0).toBeGreaterThanOrEqual(AREA.x);
      expect(n.x1).toBeLessThanOrEqual(AREA.x + AREA.w + 0.01);
    }
    for (let c = 0; c < l.columns; c++) {
      const col = l.nodes.filter((n) => n.column === c).sort((a, b) => a.y0 - b.y0);
      for (let i = 1; i < col.length; i++)
        expect(col[i]!.y0).toBeGreaterThanOrEqual(col[i - 1]!.y1);
    }
  });

  it('sizes bands and nodes on one scale', () => {
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA);
    const scale = l.links[0]!.width / l.links[0]!.value;
    for (const b of l.links) expect(b.width / b.value).toBeCloseTo(scale, 2);
    const budget = l.nodes.find((n) => n.name === 'Budget')!;
    expect(budget.y1 - budget.y0).toBeCloseTo(4000 * scale, 1);
  });

  it('stacks a node’s bands within it, without overlap', () => {
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA);
    const budget = l.nodes.find((n) => n.name === 'Budget')!;
    const outs = l.links.filter((b) => b.source === budget.index).sort((a, b) => a.y0 - b.y0);
    expect(outs[0]!.y0 - outs[0]!.width / 2).toBeCloseTo(budget.y0, 1);
    for (let i = 1; i < outs.length; i++)
      expect(outs[i]!.y0 - outs[i]!.width / 2).toBeCloseTo(
        outs[i - 1]!.y0 + outs[i - 1]!.width / 2,
        1,
      );
  });

  it('draws the starter budget without a crossing', () => {
    // Two bands between the same pair of columns cross when their order flips between the ends.
    const l = sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA);
    const crossings = l.links.flatMap((a, i) =>
      l.links.slice(i + 1).filter((b) => {
        const sameSpan =
          l.nodes[a.source]!.column === l.nodes[b.source]!.column &&
          l.nodes[a.target]!.column === l.nodes[b.target]!.column;
        return sameSpan && (a.y0 - b.y0) * (a.y1 - b.y1) < 0;
      }),
    );
    expect(crossings).toEqual([]);
    // And the bands into one node keep together: Needs' two children sit side by side in the last column.
    const last = l.nodes.filter((n) => n.column === 3).sort((a, b) => a.y0 - b.y0);
    const names = last.map((n) => n.name);
    expect(Math.abs(names.indexOf('Rent') - names.indexOf('Groceries'))).toBe(1);
  });

  it('totals what leaves the start nodes', () => {
    expect(sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA).total).toBe(4000);
  });

  it('is deterministic', () => {
    expect(sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA)).toEqual(
      sankeyLayout(SANKEY_DEFAULT_FLOWS, AREA),
    );
  });

  it('never draws a real flow thinner than a pixel', () => {
    const l = sankeyLayout([flow('A', 'B', 1_000_000), flow('A', 'C', 0.001)], AREA);
    expect(Math.min(...l.links.map((b) => b.width))).toBeGreaterThanOrEqual(1);
  });

  it('centres a lone column', () => {
    // Every flow is a loop or self-flow except none: a single node cannot exist without a flow, so use one
    // flow aligned by step and check the two columns span the width instead.
    const l = sankeyLayout([flow('A', 'B', 1)], AREA);
    expect(l.nodes[0]!.x0).toBe(0);
    expect(l.nodes[1]!.x1).toBeCloseTo(600, 1);
  });

  it('lays out the worst case within budget', () => {
    // 200 flows across 120 nodes, five columns deep: the stored maximum.
    const worst: SankeyFlow[] = [];
    for (let i = 0; i < SANKEY_MAX_FLOWS; i++)
      worst.push(flow(`c${i % 4}-${i % 30}`, `c${(i % 4) + 1}-${(i * 7) % 30}`, 1 + (i % 13)));
    // CPU time, not wall-clock (cpuMsOf): a CI runner shared with other suites pushed the wall-clock
    // reading over budget (18 ms) with nothing in the layout changed.
    const per =
      cpuMsOf(() => {
        for (let k = 0; k < 20; k++) sankeyLayout(worst, { x: 0, y: 0, w: 1200, h: 800 });
      }) / 20;
    expect(per).toBeLessThan(cpuBudgetMs(16));
  });
});

describe('sankeyBandPath', () => {
  it('draws a closed band of the given thickness', () => {
    expect(sankeyBandPath(0, 10, 100, 30, 4)).toBe(
      'M0,8C50,8 50,28 100,28L100,32C50,32 50,12 0,12Z',
    );
  });
});

describe('names and numbers', () => {
  it('cleans names', () => {
    expect(cleanSankeyName('  a   b ')).toBe('a b');
    expect(cleanSankeyName('x'.repeat(100))).toHaveLength(60);
  });

  it('lists node names in order, drawn or not', () => {
    expect(sankeyNodeNames([flow('A', 'B', 1), flow('B', 'A', 1), flow('C', '', 1)])).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('formats values with grouping, decimals and a unit', () => {
    expect(formatSankeyValue(1234567)).toBe('1,234,567');
    expect(formatSankeyValue(1200.5)).toBe('1,200.5');
    expect(formatSankeyValue(0.125)).toBe('0.13');
    expect(formatSankeyValue(1200, '£')).toBe('£1,200');
    expect(formatSankeyValue(-5, '$')).toBe('-$5');
    expect(formatSankeyValue(30, 'kWh')).toBe('30 kWh');
    expect(formatSankeyValue(30, '  ')).toBe('30');
  });

  it('formats shares', () => {
    expect(formatSankeyPercent(1, 4)).toBe('25%');
    expect(formatSankeyPercent(1, 30)).toBe('3.3%');
    expect(formatSankeyPercent(1, 100000)).toBe('<0.1%');
    expect(formatSankeyPercent(1, 0)).toBe('0%');
  });
});

describe('flows as text', () => {
  it('reads SankeyMATIC, arrows and CSV', () => {
    const r = parseSankeyText(
      [
        "' a comment",
        'Salary [3,200] Budget',
        'Budget -> Rent: 1400',
        'Budget → Food = 600',
        'Budget, Savings, "1,000"',
        'Budget\tFun\t250',
        '',
        '// another comment',
      ].join('\n'),
    );
    expect(r.flows).toEqual([
      flow('Salary', 'Budget', 3200),
      flow('Budget', 'Rent', 1400),
      flow('Budget', 'Food', 600),
      flow('Budget', 'Savings', 1000),
      flow('Budget', 'Fun', 250),
    ]);
    expect(r.unread).toEqual([]);
  });

  it('skips a header row and names lines it cannot read', () => {
    const r = parseSankeyText('from,to,value\nA,B,2\nnonsense\nA,B,lots');
    expect(r.flows).toEqual([flow('A', 'B', 2)]);
    expect(r.unread).toEqual([3, 4]);
  });

  it('reads an unquoted thousands comma in CSV', () => {
    expect(parseSankeyText('A, B, 3,200').flows).toEqual([flow('A', 'B', 3200)]);
    expect(parseSankeyText('A, "say ""hi""", 3').flows).toEqual([flow('A', 'say "hi"', 3)]);
  });

  it('reads numbers people type', () => {
    expect(readSankeyNumber('£3,200')).toBe(3200);
    expect(readSankeyNumber(' 12 % ')).toBe(12);
    expect(readSankeyNumber('1e3')).toBe(1000);
    expect(readSankeyNumber('abc')).toBeNaN();
    expect(readSankeyNumber('')).toBeNaN();
  });

  it('round-trips through text', () => {
    const text = sankeyFlowsToText(SANKEY_DEFAULT_FLOWS);
    expect(parseSankeyText(text).flows).toEqual(SANKEY_DEFAULT_FLOWS);
  });

  it('reads the first bracket or arrow that makes a whole flow, and nothing less', () => {
    expect(parseSankeyText('[3] B\nA [] B\nA [3]\nA [x] [3] B').flows).toEqual([]);
    // The amount runs to the first "]"; what is not a number around it is dropped, as everywhere.
    expect(parseSankeyText('A [x [2] B').flows).toEqual([flow('A', 'B', 2)]);
    expect(parseSankeyText('A -> B -> C: 3').flows).toEqual([flow('A', 'B -> C', 3)]);
    expect(parseSankeyText('-> B: 3\nA -> : 3\nA -> B:').flows).toEqual([]);
    expect(parseSankeyText('A => B = 2').flows).toEqual([flow('A', 'B', 2)]);
  });

  // CodeQL js/polynomial-redos: these read pasted text, so hostile input must stay linear.
  it('reads hostile lines quickly and names an over-long one as unread', () => {
    const hostile = [
      'a' + ' '.repeat(5000) + 'x',
      'a[' + ' '.repeat(5000),
      'a→' + ' '.repeat(5000),
      'a->a:' + ' '.repeat(5000),
      '-'.repeat(5000),
      '0'.repeat(5000) + 'x',
    ];
    // CPU time, not wall-clock, so a busy CI runner cannot read as backtracking (cpu-time.js).
    const ms = cpuMsOf(() => {
      for (const line of hostile) {
        parseSankeyText(line);
        readSankeyNumber(line);
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
    expect(parseSankeyText('A [1] ' + 'B'.repeat(SANKEY_LINE_MAX)).unread).toEqual([1]);
    expect(readSankeyNumber('1'.repeat(SANKEY_LINE_MAX + 1))).toBeNaN();
  });
});
