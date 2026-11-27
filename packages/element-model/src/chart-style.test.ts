import { describe, expect, it } from 'vitest';
import {
  areaFadeId,
  barPath,
  chartLegendGaps,
  chartLegendPx,
  chartLineWidth,
  chartTextScale,
  chartTickPx,
  chartValuePx,
  smoothPath,
} from './chart-style';

// How a chart is drawn (docs/specs/009-elements/pie-chart.md "How a chart is drawn").
describe('chart style', () => {
  it('grows all of a chart’s text with its short side, its Text Size the base and never the cap', () => {
    // At or under the board default the chart keeps its Text Size: Medium's 14px key, 12px numbers, 11px axis.
    expect(chartTextScale({ width: 120, height: 100 })).toBe(1);
    expect(chartLegendPx({ width: 260, height: 220 })).toBe(14);
    expect(chartValuePx({ width: 260, height: 220 })).toBe(12);
    expect(chartTickPx({ width: 260, height: 220 })).toBe(11);
    expect(chartTickPx({ width: 120, height: 100, textSize: 'sm' })).toBe(9);
    // A slide's 1600 x 880 chart reads from across the room, every size together.
    const slide = { width: 1600, height: 880 };
    expect(chartTextScale(slide)).toBeCloseTo((880 / 240) ** 0.6);
    expect(chartLegendPx(slide)).toBe(31);
    expect(chartValuePx(slide)).toBe(26);
    expect(chartTickPx(slide)).toBe(24);
    expect(chartLegendPx({ ...slide, textSize: 'lg' })).toBeGreaterThan(chartLegendPx(slide));
  });

  it('weights a line from 2px on a small plot to 3.5px on a slide-sized one', () => {
    expect(chartLineWidth(100, 80)).toBe(2);
    expect(chartLineWidth(330, 330)).toBe(3);
    expect(chartLineWidth(900, 600)).toBe(3.5);
  });

  it('draws a smooth line that never overshoots a point', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M 1 2');
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ]),
    ).toBe('M 0 0 L 10 5');
    // A peak at (10, 0): both control points beside it stay level with it, so the curve turns there.
    const peak = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(peak).toBe('M 0 10 C 3.33 6.67 6.67 0 10 0 C 13.33 0 16.67 6.67 20 10');
    // A run that rises then levels never dips under the level stretch.
    const ys = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ])
      .split(/[ MC]+/)
      .filter(Boolean)
      .map(Number)
      .filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    // Two points at one x keep a straight join rather than dividing by zero.
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ]),
    ).not.toContain('NaN');
  });

  it('rounds a bar at its value end and keeps its baseline end square', () => {
    expect(barPath(0, 0, 40, 100, 'top')).toBe(
      'M 0 100 V 5.6 A 5.6 5.6 0 0 1 5.6 0 H 34.4 A 5.6 5.6 0 0 1 40 5.6 V 100 Z',
    );
    expect(barPath(0, 0, 40, 100, 'bottom')).toMatch(/^M 40 0 V 94.4 A /);
    expect(barPath(0, 0, 100, 40, 'right')).toMatch(/^M 0 0 H 94.4 A /);
    expect(barPath(0, 0, 100, 40, 'left')).toMatch(/^M 100 40 H 5.6 A /);
    // Never a pill on a short bar, as round as its thickness on a wide one, and a bar of no length is a plain
    // rectangle.
    expect(barPath(0, 0, 40, 1, 'top')).toContain('A 1 1');
    expect(barPath(0, 0, 200, 100, 'top')).toContain('A 28 28');
    expect(barPath(0, 0, 40, 0, 'top')).toBe('M 0 0 H 40 V 0 H 0 Z');
  });

  it('names an area’s fade for its chart and series alone', () => {
    expect(areaFadeId('abc', 0)).toBe('chart-fade-abc-3-0');
    expect(areaFadeId('a b"<', 1)).toBe('chart-fade-ab-5-1');
    expect(areaFadeId('a b', 0)).not.toBe(areaFadeId('ab', 0));
  });

  it("keeps the key's old spacing at the board default and grows it with a slide-sized key", () => {
    expect(chartLegendGaps(14)).toEqual({ swatch: 4, item: 10 });
    expect(chartLegendGaps(31)).toEqual({ swatch: 9, item: 22 });
  });
});
