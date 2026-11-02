import { describe, expect, it } from 'vitest';
import { barMarks, DOUGHNUT_HOLE, lineMarks, pieMarks, scatterX } from './chart-marks';
import { svgBarChart, svgLineChart, svgPieChart } from './svg-render-charts';
import { createShape } from './shape-factory';
import type { BoxedElement, ShapeElement } from './index';

const area = { x: 0, y: 0, w: 200, h: 100 };
const slices = [
  { label: 'A', value: 30 },
  { label: 'B', value: 10 },
];

describe('chart marks (docs/specs/009-elements/pie-chart.md "Chart types")', () => {
  it('cuts a doughnut’s hole out of each wedge, at 55% of its radius', () => {
    const pie = pieMarks(area, slices, false);
    const ring = pieMarks(area, slices, true);
    expect(pie.hole).toBe(0);
    expect(ring.hole).toBeCloseTo(ring.rad * DOUGHNUT_HOLE);
    // A pie wedge starts at the centre; a ring segment does not.
    expect(pie.wedges[0]!.d.startsWith(`M ${pie.cx} ${pie.cy}`)).toBe(true);
    expect(ring.wedges[0]!.d.startsWith(`M ${ring.cx} ${ring.cy}`)).toBe(false);
    // Readouts sit in the ring, not at the hole.
    const tip = ring.wedges[0]!.tip;
    const r = Math.hypot(tip.x - ring.cx, tip.y - ring.cy);
    expect(r).toBeGreaterThan(ring.hole);
    expect(r).toBeLessThan(ring.rad);
  });

  it('draws a whole ring for a single datum, and leaves a whole pie to a circle', () => {
    const one = [{ label: 'All', value: 5 }];
    expect(pieMarks(area, one, false).wedges[0]).toMatchObject({ full: true, d: '' });
    const ring = pieMarks(area, one, true).wedges[0]!;
    expect(ring.full).toBe(true);
    expect(ring.d.match(/M /g)).toHaveLength(2);
  });

  it('skips an empty slice', () => {
    expect(pieMarks(area, [...slices, { label: 'C', value: 0 }], true).wedges[2]!.d).toBe('');
  });

  it('lays columns upright from the bottom and bars rightward from the left', () => {
    const cols = barMarks(area, slices, false);
    expect(cols.bars[0]!.h).toBeGreaterThan(cols.bars[1]!.h);
    expect(cols.bars[0]!.y + cols.bars[0]!.h).toBeCloseTo(cols.baseline.y1);
    const bars = barMarks(area, slices, true);
    expect(bars.baseline.x1).toBe(bars.baseline.x2);
    expect(bars.bars[0]!.w).toBeGreaterThan(bars.bars[1]!.w);
    expect(bars.bars[0]!.x).toBe(bars.baseline.x1);
    expect(bars.bars[0]!.y).toBeLessThan(bars.bars[1]!.y);
    expect(bars.bars[0]!.tip.x).toBeCloseTo(bars.bars[0]!.x + bars.bars[0]!.w);
  });

  // docs/specs/009-elements/pie-chart.md "Below zero on a column or bar chart".
  it('hangs a negative column below a zero baseline, and runs a negative bar left of it', () => {
    const mixed = [
      { label: 'Q1', value: 30 },
      { label: 'Q2', value: -10 },
    ];
    const cols = barMarks(area, mixed, false);
    const zero = cols.baseline.y1;
    const [up, down] = cols.bars;
    // The positive column ends on the baseline, the negative one starts there and hangs below.
    expect(up!.y + up!.h).toBeCloseTo(zero);
    expect(down!.y).toBeCloseTo(zero);
    expect(down!.h).toBeGreaterThan(0);
    expect(up!.h / down!.h).toBeCloseTo(3);
    expect(down!.tip.y).toBeCloseTo(zero + down!.h);
    // The baseline sits up the plot, and the names go below the whole plot.
    expect(zero).toBeLessThan(cols.floor);
    expect(cols.floor).toBeCloseTo(down!.y + down!.h);
    expect(cols.origin.y).toBeCloseTo(zero);

    const bars = barMarks(area, mixed, true);
    const zeroX = bars.baseline.x1;
    expect(bars.bars[0]!.x).toBeCloseTo(zeroX);
    expect(bars.bars[1]!.x + bars.bars[1]!.w).toBeCloseTo(zeroX);
    expect(bars.bars[1]!.tip.x).toBeCloseTo(bars.bars[1]!.x);
  });

  it('draws a chart with no negatives exactly as before, its baseline at the foot', () => {
    const cols = barMarks(area, slices, false);
    expect(cols.floor).toBeCloseTo(cols.baseline.y1);
    expect(cols.baseline.y1).toBeCloseTo(88);
  });

  it('covers the negatives with Show Axis, zero a tick on the baseline', () => {
    const cols = barMarks(
      area,
      [
        { label: 'A', value: 120 },
        { label: 'B', value: -40 },
      ],
      false,
      0,
      0,
      true,
    );
    const texts = cols.axis.ticks.map((t) => t.text);
    expect(texts[0]).toBe('-50');
    expect(texts).toContain('0');
    expect(cols.axis.ticks.find((t) => t.text === '0')!.at).toBeCloseTo(cols.baseline.y1);
    expect(cols.axis.ticks[0]!.at).toBeCloseTo(cols.floor);
  });

  it('reads a scatter category as a number', () => {
    expect(scatterX(' 1,200 ')).toBe(1200);
    expect(scatterX('-3.5')).toBe(-3.5);
    expect(scatterX('')).toBeNull();
    expect(scatterX('Jan')).toBeNull();
  });

  it('places scatter points at their numbers, with five ticks', () => {
    const m = lineMarks(area, ['0', '10', '1'], [{ name: 'Y', values: [1, 2, 3] }], 'scatter');
    const [p0, p1, p2] = m.points[0]!;
    expect(p0!.x).toBeCloseTo(m.plot.x);
    expect(p1!.x).toBeCloseTo(m.plot.x + m.plot.w);
    expect(p2!.x).toBeCloseTo(m.plot.x + m.plot.w / 10);
    expect(m.lines).toEqual(['']);
    expect(m.labels.map((l) => l.text)).toEqual(['0', '2.5', '5', '7.5', '10']);
    expect(m.dot).toBe(4);
  });

  it('spaces a scatter of text categories evenly, as a line', () => {
    const m = lineMarks(area, ['a', 'b'], [{ name: 'Y', values: [1, 2] }], 'scatter');
    const line = lineMarks(area, ['a', 'b'], [{ name: 'Y', values: [1, 2] }], 'line');
    expect(m.points).toEqual(line.points);
    expect(m.labels).toEqual(line.labels);
  });

  it('widens an all-equal scatter x', () => {
    const m = lineMarks(area, ['5', '5'], [{ name: 'Y', values: [1, 2] }], 'scatter');
    expect(m.points[0]![0]!.x).toBeCloseTo(m.plot.x);
    expect(m.labels[4]!.text).toBe('6');
  });

  it('writes large and tiny ticks short', () => {
    const big = lineMarks(area, ['0', '2000000'], [{ name: 'Y', values: [1, 2] }], 'scatter');
    expect(big.labels[4]!.text).toBe('2.0e+6');
    const tiny = lineMarks(area, ['0', '0.0004'], [{ name: 'Y', values: [1, 2] }], 'scatter');
    expect(tiny.labels[1]!.text).toBe('1.0e-4');
  });

  it('fills each area down to zero', () => {
    const m = lineMarks(area, ['a', 'b'], [{ name: 'Y', values: [1, 3] }], 'area');
    expect(m.areas).toHaveLength(1);
    expect(m.areas[0]).toMatch(/^M .* Z$/);
    expect(lineMarks(area, [], [{ name: 'Y', values: [] }], 'area').areas).toEqual(['']);
    expect(lineMarks(area, ['a'], [{ name: 'Y', values: [1] }], 'line').areas).toEqual([]);
  });

  // Performance guard (spec "Chart types"; the read caps a Sheet's chart at 500 categories and 12 series): every
  // type's marks for the largest chart a Sheet can make stay well inside a frame.
  it('lays out 500 categories × 12 series quickly', () => {
    const categories = Array.from({ length: 500 }, (_, i) => String(i));
    const series = Array.from({ length: 12 }, (_, s) => ({
      name: `S${s}`,
      values: categories.map((_, i) => Math.sin(i + s) * 100),
    }));
    const el = (variant: 'area' | 'scatter') =>
      ({
        ...createShape('line-chart', 0, 0),
        width: 800,
        height: 400,
        lineCategories: categories,
        lineSeries: series,
        chartVariant: variant,
      }) as ShapeElement;
    for (const variant of ['area', 'scatter'] as const) {
      lineMarks(area, categories, series, variant);
      svgLineChart(el(variant), '#000');
      const t0 = performance.now();
      for (let k = 0; k < 10; k++) svgLineChart(el(variant), '#000');
      const each = (performance.now() - t0) / 10;
      // Measured about 10.5 ms (area) and 3.3 ms (scatter) per export on a laptop, October 2026 (a line chart of the
      // same size: 8.3 ms); the budget leaves room for a loaded CI runner.
      expect(each).toBeLessThan(80);
    }
  });
});

describe('chart types in the export', () => {
  const shape = (kind: 'pie-chart' | 'bar-chart' | 'line-chart', extra: Partial<ShapeElement>) =>
    ({
      ...createShape(kind, 0, 0),
      x: 0,
      y: 0,
      width: 260,
      height: 220,
      ...extra,
    }) as BoxedElement & {
      type: 'shape';
    };

  it('draws a doughnut as even-odd ring segments', () => {
    const svg = svgPieChart(shape('pie-chart', { chartVariant: 'doughnut' }), '#000');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svgPieChart(shape('pie-chart', {}), '#000')).not.toContain('evenodd');
  });

  it('draws a whole doughnut as a ring, a whole pie as a circle', () => {
    const one = { pieSlices: [{ label: 'All', value: 1 }] };
    expect(
      svgPieChart(shape('pie-chart', { ...one, chartVariant: 'doughnut' }), '#000'),
    ).not.toContain('<circle');
    expect(svgPieChart(shape('pie-chart', one), '#000')).toContain('<circle');
  });

  it('draws a bar chart’s baseline upright', () => {
    const svg = svgBarChart(shape('bar-chart', { chartVariant: 'horizontal' }), '#000');
    const m = svg.match(/<path d="M ([\d.]+) [\d.]+ L ([\d.]+) /)!;
    expect(m[1]).toBe(m[2]);
  });

  it('fills an area chart and draws a scatter without lines', () => {
    const area = svgLineChart(shape('line-chart', { chartVariant: 'area' }), '#000');
    expect(area).toContain('fill-opacity="0.25"');
    expect(area).toContain('<polyline');
    const scatter = svgLineChart(shape('line-chart', { chartVariant: 'scatter' }), '#000');
    expect(scatter).not.toContain('<polyline');
    expect(scatter).toContain('r="4"');
  });
});
