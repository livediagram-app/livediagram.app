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
});
