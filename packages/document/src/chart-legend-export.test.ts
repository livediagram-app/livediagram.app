// An exported chart's bottom legend places each name clear of the next swatch: estimated at a flat half an em per
// character, "Home" ran into Food's swatch in a Sheet's pie chart (docs/specs/009-elements/pie-chart.md).
import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { renderElementsToSvg } from './svg-render';
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
    const swatches = [...svg.matchAll(/<rect x="([\d.-]+)"[^>]*rx="2"/g)].map((m) => Number(m[1]));
    const names = [
      ...svg.matchAll(/<text x="([\d.-]+)"[^>]*font-size="([\d.]+)"[^>]*>(\w+)<\/text>/g),
    ]
      .filter((m) => m[3]! in INTER)
      .map((m) => ({ x: Number(m[1]), px: Number(m[2]), label: m[3]! }));
    expect(names.map((n) => n.label)).toEqual(Object.keys(INTER));
    for (let i = 0; i < names.length - 1; i++) {
      const n = names[i]!;
      // On the same row, the next swatch starts after this name ends.
      if (swatches[i + 1]! > n.x)
        expect(n.x + INTER[n.label]! * n.px).toBeLessThan(swatches[i + 1]!);
    }
  });
});
