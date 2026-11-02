// An exported chart's text names the export's sans font when no font is given: left bare, a standalone SVG viewer drew
// it in its serif default while the rest of the export was sans (docs/specs/009-elements/pie-chart.md).
import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { renderElementsToSvg } from './svg-render';
import type { Element } from './index';

const shapes = ['bar-chart', 'line-chart', 'pie-chart', 'sankey'] as const;

describe('chart text in an export', () => {
  it.each(shapes)('%s: every text names a font', (shape) => {
    const el = { ...createShape(shape, 0, 0), id: 'c', chartValues: true } as Element;
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] }, {});
    const texts = svg.match(/<text\b[^>]*>/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((t) => !t.includes('font-family='))).toEqual([]);
  });
});
