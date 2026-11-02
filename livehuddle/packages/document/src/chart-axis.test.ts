import { describe, expect, it } from 'vitest';
import { axisLabelRoom, axisScale, rightAxisSeries } from './chart-axis';
import { barMarks, lineMarks } from './chart-marks';
import { normaliseElement } from './element-normalise';
import { renderElementsToSvg } from './svg-render';

// docs/specs/009-elements/pie-chart.md "Show Axis", "A second axis".

describe('axisScale', () => {
  it('runs from zero to the next round tick past the data, a tick at each round step', () => {
    const s = axisScale(0, 160);
    expect(s.ticks.map((t) => t.value)).toEqual([0, 50, 100, 150, 200]);
    expect([s.min, s.max]).toEqual([0, 200]);
    expect(axisScale(0, 1240).ticks.map((t) => t.text)).toEqual(['0', '500', '1,000', '1,500']);
    expect(axisScale(0, 0.3).ticks.map((t) => t.value)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('holds zero for data all below it and widens a flat range', () => {
    expect(axisScale(-30, 80).ticks.map((t) => t.value)).toEqual([-50, 0, 50, 100]);
    expect(axisScale(5, 5).max).toBeGreaterThan(5);
    expect(axisScale(0, 0).ticks.length).toBeGreaterThan(1);
  });

  it('reads big ticks short and makes room for the widest', () => {
    const s = axisScale(0, 2_400_000);
    expect(s.ticks.map((t) => t.text)).toEqual(['0', '1M', '2M', '3M']);
    expect(axisLabelRoom(s)).toBeGreaterThan(axisLabelRoom(axisScale(0, 8)));
  });
});

describe('rightAxisSeries', () => {
  it('puts a series on the right only while another stays on the left', () => {
    expect(
      rightAxisSeries([
        { name: 'a', values: [] },
        { name: 'b', values: [], axis: 'right' },
      ]),
    ).toEqual([false, true]);
    expect(rightAxisSeries([{ name: 'a', values: [], axis: 'right' }])).toEqual([false]);
  });
});

describe('the marks with an axis', () => {
  const area = { x: 0, y: 0, w: 400, h: 200 };
  it('gives a line chart left ticks, and a right scale of its own to a right-hand series', () => {
    const series = [
      { name: 'Signups', values: [800, 1200] },
      { name: 'Paid', values: [90, 170], axis: 'right' as const },
    ];
    const m = lineMarks(area, ['W1', 'W2'], series, 'line', 0, 0, true);
    expect(m.axis.left.map((t) => t.text)).toEqual(['0', '500', '1,000', '1,500']);
    expect(m.axis.right.map((t) => t.text)).toEqual(['0', '50', '100', '150', '200']);
    // Paid's 170 reads against its own 0 to 200, high on the plot, not flat along the bottom.
    expect(m.points[1]![1]!.y).toBeLessThan(m.plot.y + m.plot.h * 0.25);
    expect(m.plot.x).toBeGreaterThan(10);
    const plain = lineMarks(area, ['W1', 'W2'], series, 'line');
    expect(plain.axis).toEqual({ left: [], right: [] });
    // Area fills drop to their own axis's zero.
    const filled = lineMarks(area, ['W1', 'W2'], series, 'area', 0, 0, true);
    expect(filled.areas[1]).toContain(`${m.plot.y + m.plot.h}`);
  });

  it('gives a column chart ticks up its side and a bar chart ticks along its bottom', () => {
    const data = [
      { label: 'Jul', value: 120 },
      { label: 'Sep', value: 160 },
    ];
    const col = barMarks(area, data, false, 0, 0, true);
    expect(col.axis.ticks.map((t) => t.text)).toEqual(['0', '50', '100', '150', '200']);
    expect(col.axis.ticks[0]!.at).toBeCloseTo(col.baseline.y1);
    const bar = barMarks(area, data, true, 0, 0, true);
    expect(bar.axis.ticks[0]!.at).toBeCloseTo(bar.baseline.x1);
    expect(barMarks(area, data, false).axis.ticks).toEqual([]);
  });
});

describe('a series axis read in', () => {
  it('keeps "right" and drops anything else', () => {
    const el = normaliseElement({
      id: 'c',
      type: 'shape',
      shape: 'line-chart',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      lineSeries: [
        { name: 'a', values: [1], axis: 'right' },
        { name: 'b', values: [2], axis: 'left' },
      ],
    }) as { lineSeries: { axis?: string }[] };
    expect(el.lineSeries.map((s) => s.axis)).toEqual(['right', undefined]);
  });
});

describe('the axis in an export', () => {
  it('draws the ticks and gridlines, the right axis in its series colour, only with Show Axis', () => {
    const chart = (extra: Record<string, unknown>) =>
      renderElementsToSvg({
        id: 't',
        name: 'T',
        elements: [
          {
            id: 'c',
            type: 'shape',
            shape: 'line-chart',
            x: 0,
            y: 0,
            width: 400,
            height: 240,
            lineCategories: ['W1', 'W2'],
            lineSeries: [
              { name: 'Signups', values: [800, 1200] },
              { name: 'Paid', values: [90, 170], axis: 'right', color: '#ff0000' },
            ],
            ...extra,
          },
        ],
      });
    const on = chart({ chartAxis: true });
    expect(on).toContain('>1,500</text>');
    expect(on).toMatch(/text-anchor="start"[^>]*>200<\/text>/);
    // The right edge in Paid's colour.
    expect(on).toMatch(/stroke="#ff0000" stroke-width="2"/);
    expect(chart({})).not.toContain('>1,500</text>');
    const columns = renderElementsToSvg({
      id: 't',
      name: 'T',
      elements: [
        {
          id: 'b',
          type: 'shape',
          shape: 'bar-chart',
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          pieSlices: [{ label: 'Jul', value: 160 }],
          chartAxis: true,
        },
      ],
    });
    expect(columns).toContain('>200</text>');
  });
});
