import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './element';
import { PIE_PALETTE } from './data-shapes';
import {
  sankeyBandReadout,
  sankeyFrame,
  sankeyLabelHalo,
  sankeyNodeReadout,
  SANKEY_NEUTRAL_BAND,
} from './sankey-frame';
import { SANKEY_DEFAULT_FLOWS } from './sankey-model';
import { svgSankey } from './svg-render-sankey';
import { createShape } from './testing/elements';

// docs/specs/009-elements/sankey.md "How it draws". Each product's sankey-render test also reads its validator and
// normaliser through the bindings; these read the shared frame and renderer alone.
const budget = (patch: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('sankey', 10, 20),
  id: 'sk1',
  sankeyFlows: SANKEY_DEFAULT_FLOWS.map((f) => ({ ...f })),
  ...patch,
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

describe('a Sankey on a ground', () => {
  it('draws its nodes and names adapted to the tones it sits on, and as written with none', () => {
    const plain = svgSankey(budget(), '#ffffff');
    expect(svgSankey(budget(), '#ffffff', undefined, undefined, [])).toBe(plain);
    const onWhite = svgSankey(budget(), '#ffffff', undefined, undefined, ['#ffffff']);
    expect(onWhite).not.toBe(plain);
    expect(onWhite).not.toContain('fill="#ffffff" font');
  });
});
