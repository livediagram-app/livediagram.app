// An exported chart's bottom legend places each name clear of the next swatch: estimated at a flat half an em per
// character, "Home" ran into Food's swatch in a Sheet's pie chart (docs/specs/009-elements/pie-chart.md).
import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { renderElementsToSvg } from './svg-render';
import { fitLegendLabel } from './svg-render-charts';
import { textAdvanceEm } from '@liveworkspace/model-core/text-advance';
import type { Element } from './index';

// Inter's drawn widths in em (as text-advance.test.ts measured them).
const INTER: Record<string, number> = {
  Home: 2.788,
  Food: 2.361,
  Travel: 2.858,
  Leisure: 3.423,
  Savings: 3.693,
};

describe('a chart legend in an export', () => {
  it('leaves room after each name before the next swatch', () => {
    const slices = Object.keys(INTER).map((label, i) => ({ label, value: 10 + i }));
    const el = {
      ...createShape('pie-chart', 0, 0),
      id: 'c',
      width: 560,
      height: 320,
      pieSlices: slices,
    } as Element;
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] }, {});
    // Each tag read on its own, its attributes by name: no two unbounded runs side by side to backtrack over.
    const attr = (tag: string, name: string) => {
      const at = tag.indexOf(` ${name}="`);
      return at < 0
        ? null
        : tag.slice(at + name.length + 3, tag.indexOf('"', at + name.length + 3));
    };
    const tags = [...svg.matchAll(/<(rect|text)\b[^>]*>/g)];
    const swatches = tags
      .filter((m) => m[1] === 'rect' && attr(m[0], 'rx') === '2')
      .map((m) => Number(attr(m[0], 'x')));
    const names = tags
      .filter((m) => m[1] === 'text')
      .map((m) => {
        const start = m.index + m[0].length;
        const label = svg.slice(start, svg.indexOf('<', start));
        return { x: Number(attr(m[0], 'x')), px: Number(attr(m[0], 'font-size')), label };
      })
      .filter((n) => n.label in INTER);
    expect(names.map((n) => n.label)).toEqual(Object.keys(INTER));
    for (let i = 0; i < names.length - 1; i++) {
      const n = names[i]!;
      // On the same row, the next swatch starts after this name ends.
      if (swatches[i + 1]! > n.x)
        expect(n.x + INTER[n.label]! * n.px).toBeLessThan(swatches[i + 1]!);
    }
  });

  // A name longer than the chart is wide is cut with an ellipsis inside the chart, as the canvas key's truncate cuts
  // it, never drawn past the chart's edges.
  const LONG = 'A very very long slice label that goes on and on forever and ever';
  const legendTexts = (pos?: 'right') => {
    const el = {
      ...createShape('pie-chart', 100, 50),
      id: 'c',
      width: 260,
      height: 220,
      pieSlices: [
        { label: 'A', value: 4 },
        { label: LONG, value: 3 },
      ],
      ...(pos ? { chartLegendPosition: pos } : {}),
    } as Element;
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] }, {});
    return [...svg.matchAll(/<text\b[^>]*>/g)].map((m) => {
      const start = m.index + m[0].length;
      const at = m[0].indexOf(' x="');
      const sizeAt = m[0].indexOf(' font-size="');
      return {
        x: Number(m[0].slice(at + 4, m[0].indexOf('"', at + 4))),
        px: Number(m[0].slice(sizeAt + 12, m[0].indexOf('"', sizeAt + 12))),
        label: svg.slice(start, svg.indexOf('<', start)),
      };
    });
  };

  for (const pos of [undefined, 'right'] as const) {
    it(`cuts a long name to the chart with an ellipsis (${pos ?? 'bottom'} legend)`, () => {
      const long = legendTexts(pos).find((t) => t.label.startsWith('A very'));
      expect(long).toBeDefined();
      expect(long!.label.endsWith('…')).toBe(true);
      expect(long!.x).toBeGreaterThanOrEqual(100);
      expect(long!.x + textAdvanceEm(long!.label) * long!.px).toBeLessThanOrEqual(100 + 260);
    });
  }

  it('keeps a name that fits whole, and cuts on whole characters', () => {
    expect(fitLegendLabel('Food', 200, 14)).toBe('Food');
    const cut = fitLegendLabel('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉', 40, 14);
    expect(cut.endsWith('…')).toBe(true);
    expect([...cut.slice(0, -1)].every((ch) => ch === '🎉')).toBe(true);
    expect(fitLegendLabel('Anything', 0, 14)).toBe('…');
  });
});
