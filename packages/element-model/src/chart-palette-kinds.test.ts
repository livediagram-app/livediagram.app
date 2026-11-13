import { describe, expect, it } from 'vitest';
import { drawsWithChartPalette, takesChartPalette } from './data-shapes';

// Each product's docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board keeps the page answering":
// only a face that draws in the chart colours takes the palette, so a pick renders no other view for it.
describe('drawsWithChartPalette', () => {
  it('is the charts, the Sankey diagram and the legend, never a plain box', () => {
    for (const kind of ['pie-chart', 'bar-chart', 'line-chart', 'sankey', 'legend'] as const)
      expect(drawsWithChartPalette(kind)).toBe(true);
    for (const kind of ['square', 'circle', 'progress'] as const)
      expect(drawsWithChartPalette(kind)).toBe(false);
    expect(takesChartPalette('legend')).toBe(false);
  });
});
