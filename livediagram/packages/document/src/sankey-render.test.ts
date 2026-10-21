import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import type { ShapeElement } from './index';
import {
  sankeyBandReadout,
  sankeyFrame,
  sankeyLabelHalo,
  sankeyNodeReadout,
  SANKEY_NEUTRAL_BAND,
} from './sankey-frame';
import { svgSankey } from './svg-render-sankey';
import { PIE_PALETTE } from './data-shapes';
import { isValidElement } from './validate';
import { normaliseElement } from './element-normalise';
import {
  renameSankeyNode,
  pruneSankeyNodes,
  withSankeyNodeColor,
  cleanSankeyFlows,
  sankeyDrawnFlows,
} from './sankey-model';

const budget = (patch: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('sankey', 10, 20),
  id: 'sk1',
  ...patch,
});

describe('a new Sankey', () => {
  it('drops as the starter budget, wide, with no label of its own', () => {
    const el = budget();
    expect(el.sankeyFlows).toHaveLength(7);
    expect(el.width).toBeGreaterThan(el.height);
    expect(el.label ?? '').toBe('');
    expect(isValidElement(el)).toBe(true);
  });
});

describe('sankeyFrame', () => {
  it('labels every node of the starter budget in full, facing inward', () => {
    const f = sankeyFrame(budget());
    expect(f.labels.every((l) => !l.hidden)).toBe(true);
    const salary = f.labels.find((l) => l.name === 'Salary')!;
    const rent = f.labels.find((l) => l.name === 'Rent')!;
    expect(salary.anchor).toBe('start');
    expect(rent.anchor).toBe('end');
    expect(salary.detail).toBe('3,200');
  });

  it('writes the unit and the percent of the whole', () => {
    expect(sankeyFrame(budget({ sankeyUnit: '£' })).labels[0]!.detail).toBe('£3,200');
    const pct = sankeyFrame(budget({ sankeyValueLabel: 'percent' }));
    expect(pct.labels.find((l) => l.name === 'Budget')!.detail).toBe('100%');
    expect(pct.labels.find((l) => l.name === 'Rent')!.detail).toBe('35%');
    const none = sankeyFrame(budget({ sankeyValueLabel: 'none' }));
    expect(none.labels.every((l) => l.detail === '')).toBe(true);
  });

  it('gives way rather than printing one label through another', () => {
    // Ten thin flows into one column of a small box: the labels cannot all fit.
    const flows = Array.from({ length: 10 }, (_, i) => ({
      from: `Source ${i}`,
      to: 'Sink',
      value: 1,
    }));
    const f = sankeyFrame(budget({ width: 220, height: 90, sankeyFlows: flows }));
    const shown = f.labels.filter((l) => !l.hidden);
    expect(shown.length).toBeLessThan(f.labels.length);
    // The biggest node keeps its label.
    expect(shown.some((l) => l.name === 'Sink')).toBe(true);
  });

  it('colours nodes by the ladder: own colour, palette, theme, built-in', () => {
    const own = sankeyFrame(budget({ sankeyNodes: [{ name: 'Budget', color: '#123456' }] }));
    expect(own.nodeColor(1)).toBe('#123456');
    expect(sankeyFrame(budget()).nodeColor(0)).toBe(PIE_PALETTE[0]);
    expect(sankeyFrame(budget(), ['#aaaaaa']).nodeColor(0)).toBe('#aaaaaa');
    const grey = sankeyFrame(budget({ chartPalette: 'grey' }), ['#aaaaaa']);
    expect(grey.nodeColor(0)).not.toBe('#aaaaaa');
  });

  it('paints bands by the chosen mode', () => {
    const b = (mode: ShapeElement['sankeyLinkColor']) => {
      const f = sankeyFrame(budget({ sankeyLinkColor: mode }));
      return f.bandPaint(f.layout.links[0]!);
    };
    expect(b(undefined)).toEqual({ kind: 'gradient', from: PIE_PALETTE[0], to: PIE_PALETTE[1] });
    expect(b('source')).toEqual({ kind: 'solid', color: PIE_PALETTE[0] });
    expect(b('target')).toEqual({ kind: 'solid', color: PIE_PALETTE[1] });
    expect(b('neutral')).toEqual({ kind: 'solid', color: SANKEY_NEUTRAL_BAND });
  });

  it('summarises itself for a screen reader', () => {
    expect(sankeyFrame(budget()).summary).toBe(
      'Sankey diagram: 7 flows between 8 nodes in 4 columns. Largest: Salary to Budget, 3,200.',
    );
    expect(sankeyFrame(budget({ sankeyFlows: [] })).summary).toBe(
      'Sankey diagram with no flows yet',
    );
  });

  it('puts a halo behind labels in the opposite of their ink', () => {
    expect(sankeyLabelHalo('#0f172a')).toBe('#ffffff');
    expect(sankeyLabelHalo('#f8fafc')).toBe('#0f172a');
  });
});

describe('readouts', () => {
  it('reads a band as where, how much and its share of the source', () => {
    const f = sankeyFrame(budget());
    const rent = f.layout.links.find((b) => f.layout.nodes[b.target]!.name === 'Rent')!;
    expect(sankeyBandReadout(f.layout, rent, '£')).toEqual({
      title: 'Needs → Rent',
      detail: '£1,400 · 70% of Needs',
    });
  });

  it('reads a node as in and out, and says when they differ (leftovers hidden)', () => {
    const f = sankeyFrame(budget());
    expect(sankeyNodeReadout(f.layout.nodes.find((n) => n.name === 'Budget')!)).toEqual({
      title: 'Budget',
      detail: 'In 4,000 · Out 4,000',
    });
    const leaky = sankeyFrame(
      budget({
        sankeyLeftover: 'hide',
        sankeyFlows: [
          { from: 'A', to: 'B', value: 10 },
          { from: 'B', to: 'C', value: 8 },
        ],
      }),
    );
    expect(sankeyNodeReadout(leaky.layout.nodes[1]!).detail).toBe('In 10 · Out 8 · 2 not sent on');
  });
});

describe('svgSankey', () => {
  it('draws gradients, bands, nodes and escaped labels at the element position', () => {
    const svg = svgSankey(
      budget({ sankeyFlows: [{ from: 'R&D <x>', to: 'Ship', value: 5 }] }),
      '#0f172a',
    );
    expect(svg).toContain('<linearGradient id="lvd-sk-sk1-0"');
    expect(svg).toContain('fill="url(#lvd-sk-sk1-0)"');
    expect(svg).toContain('translate(10 20)');
    expect(svg).toContain('R&amp;D &lt;x&gt;');
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('draws the empty state for a diagram with no flows', () => {
    expect(svgSankey(budget({ sankeyFlows: [] }) as never, '#0f172a')).toContain('No flows yet');
  });
});

describe('validation and agent input', () => {
  it('refuses a name past the bound and an unknown option', () => {
    expect(
      isValidElement(budget({ sankeyFlows: [{ from: 'x'.repeat(61), to: 'y', value: 1 }] })),
    ).toBe(false);
    expect(isValidElement(budget({ sankeyLinkColor: 'rainbow' as never }))).toBe(false);
    expect(isValidElement(budget({ sankeyUnit: 'too long a unit' }))).toBe(false);
  });

  it('keeps a zero or negative amount (the dialog names why it is hidden)', () => {
    expect(isValidElement(budget({ sankeyFlows: [{ from: 'a', to: 'b', value: -2 }] }))).toBe(true);
  });

  it('reads d3-style source / target and text amounts from an agent', () => {
    const el = normaliseElement({
      ...budget(),
      sankeyFlows: [{ source: '  Coal ', target: 'Power', amount: '1,200' }],
      sankeyLinkColor: 'rainbow',
      sankeyUnit: '  TWh  ',
    }) as ShapeElement;
    expect(el.sankeyFlows).toEqual([{ from: 'Coal', to: 'Power', value: 1200 }]);
    expect(el.sankeyLinkColor).toBeUndefined();
    expect(el.sankeyUnit).toBe('TWh');
    expect(isValidElement(el)).toBe(true);
  });
});

describe('node edits', () => {
  it('renames a node in every flow and moves its colour with it', () => {
    const r = renameSankeyNode(
      [
        { from: 'A', to: 'B', value: 1 },
        { from: 'B', to: 'C', value: 1 },
      ],
      [{ name: 'B', color: '#111111' }],
      'B',
      'Bee',
    );
    expect(r.flows.map((f) => [f.from, f.to])).toEqual([
      ['A', 'Bee'],
      ['Bee', 'C'],
    ]);
    expect(r.nodes).toEqual([{ name: 'Bee', color: '#111111' }]);
  });

  it('merges onto an existing name, keeping one colour', () => {
    const r = renameSankeyNode(
      [{ from: 'A', to: 'B', value: 1 }],
      [
        { name: 'A', color: '#111111' },
        { name: 'B', color: '#222222' },
      ],
      'B',
      'A',
    );
    expect(r.nodes).toEqual([{ name: 'A', color: '#111111' }]);
  });

  it("merges onto a name listed after it, keeping the surviving name's colour", () => {
    const r = renameSankeyNode(
      [{ from: 'A', to: 'B', value: 1 }],
      [
        { name: 'A', color: '#111111' },
        { name: 'B', color: '#222222' },
      ],
      'A',
      'B',
    );
    expect(r.nodes).toEqual([{ name: 'B', color: '#222222' }]);
  });

  it('sets, clears and prunes node colours', () => {
    const set = withSankeyNodeColor(undefined, 'A', '#123456');
    expect(set).toEqual([{ name: 'A', color: '#123456' }]);
    expect(withSankeyNodeColor(set, 'A', undefined)).toBeUndefined();
    expect(pruneSankeyNodes(set, [{ from: 'X', to: 'Y', value: 1 }])).toBeUndefined();
  });

  it('cleans flows for storing', () => {
    expect(cleanSankeyFlows([{ from: ' a  b ', to: 'c', value: Number.NaN }])).toEqual([
      { from: 'a b', to: 'c', value: 0 },
    ]);
  });
});

// docs/specs/009-elements/sankey.md "Leftovers".
describe('leftovers', () => {
  const kept = [
    { from: 'Income', to: 'Budget', value: 1000 },
    { from: 'Budget', to: 'Rent', value: 500 },
    { from: 'Budget', to: 'Food', value: 300 },
  ];

  it('draws what a middle node does not send on to a Leftover node, after the stored flows', () => {
    expect(sankeyDrawnFlows(kept, undefined, undefined)).toEqual({
      flows: [...kept, { from: 'Budget', to: 'Leftover', value: 200 }],
      stored: 3,
    });
    expect(sankeyDrawnFlows(kept, 'show', ' Spare ').flows.at(-1)).toEqual({
      from: 'Budget',
      to: 'Spare',
      value: 200,
    });
  });

  it('draws none when hidden, for a start or an end, or for a node sending on more than it gets', () => {
    expect(sankeyDrawnFlows(kept, 'hide', undefined).flows).toHaveLength(3);
    const over = [
      { from: 'A', to: 'B', value: 5 },
      { from: 'B', to: 'C', value: 9 },
    ];
    expect(sankeyDrawnFlows(over, 'show', undefined).flows).toHaveLength(2);
    expect(sankeyDrawnFlows(undefined, 'show', undefined)).toEqual({ flows: [], stored: 0 });
  });

  it('paints a leftover band and its node quietly, and reads it as not sent on', () => {
    const f = sankeyFrame(budget({ sankeyFlows: kept }));
    const band = f.layout.links.find((b) => f.leftover(b))!;
    expect(band.flow).toBe(3);
    expect(f.bandPaint(band)).toEqual({ kind: 'solid', color: SANKEY_NEUTRAL_BAND });
    expect(f.nodeColor(band.target)).toBe(SANKEY_NEUTRAL_BAND);
    expect(f.layout.nodes[band.target]!.name).toBe('Leftover');
    expect(sankeyBandReadout(f.layout, band, '£', true)).toEqual({
      title: 'Budget → Leftover',
      detail: '£200 not sent on',
    });
    // The node now balances, so its own readout has nothing to flag.
    expect(sankeyNodeReadout(f.layout.nodes[band.source]!).detail).toBe('In 1,000 · Out 1,000');
  });

  it('joins a node somebody wrote with the same name, in its own colour', () => {
    const f = sankeyFrame(
      budget({ sankeyFlows: [...kept, { from: 'Income', to: 'Leftover', value: 50 }] }),
    );
    const node = f.layout.nodes.find((n) => n.name === 'Leftover')!;
    expect(node.inflow).toBe(250);
    expect(f.nodeColor(node.index)).not.toBe(SANKEY_NEUTRAL_BAND);
  });

  it('exports the leftover band, and validates and normalises the options', () => {
    expect(svgSankey(budget({ sankeyFlows: kept }), '#000')).toContain('Leftover');
    expect(svgSankey(budget({ sankeyFlows: kept, sankeyLeftover: 'hide' }), '#000')).not.toContain(
      'Leftover',
    );
    expect(isValidElement(budget({ sankeyLeftover: 'show', sankeyLeftoverName: 'Spare' }))).toBe(
      true,
    );
    expect(isValidElement(budget({ sankeyLeftover: 'maybe' as never }))).toBe(false);
    expect(isValidElement(budget({ sankeyLeftoverName: 'x'.repeat(61) }))).toBe(false);
    const n = normaliseElement({
      ...budget(),
      sankeyLeftover: 'maybe',
      sankeyLeftoverName: '  ',
    }) as ShapeElement;
    expect(n.sankeyLeftover).toBeUndefined();
    expect(n.sankeyLeftoverName).toBeUndefined();
  });
});
