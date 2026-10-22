// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { createShape, type ShapeElement } from '@livepages/document';
import { BarChartView } from './BarChartView';
import { LineChartView } from './LineChartView';
import { PieChartView } from './PieChartView';

// Each chart type on the canvas (docs/specs/009-elements/pie-chart.md "Chart types"), drawn from the same marks the
// export draws.
const el = (kind: 'pie-chart' | 'bar-chart' | 'line-chart', extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), width: 260, height: 220, ...extra }) as ShapeElement;

describe('chart views', () => {
  it('draws Show Axis as the export does: ticks up a column or line chart, along a bar chart, right in colour', () => {
    const series = [
      { name: 'Signups', values: [800, 1200] },
      { name: 'Paid', values: [90, 170], axis: 'right' as const, color: '#ff0000' },
    ];
    const line = render(
      <LineChartView
        element={el('line-chart', {
          chartAxis: true,
          lineCategories: ['W1', 'W2'],
          lineSeries: series,
        })}
        textColor="#000"
      />,
    ).container;
    const ticks = [...line.querySelectorAll('text')].map((t) => t.textContent);
    expect(ticks).toContain('1,500');
    const right = [...line.querySelectorAll('text[text-anchor="start"]')];
    expect(right.map((t) => t.textContent)).toContain('200');
    expect(right[0]!.getAttribute('fill')).toBe('#000');
    expect(line.querySelector('line[stroke="#ff0000"]')).not.toBeNull();
    for (const variant of [undefined, 'horizontal' as const]) {
      const bars = render(
        <BarChartView
          element={el('bar-chart', {
            chartAxis: true,
            pieSlices: [{ label: 'Jul', value: 160 }],
            ...(variant ? { chartVariant: variant } : {}),
          })}
          textColor="#000"
        />,
      ).container;
      expect([...bars.querySelectorAll('text')].map((t) => t.textContent)).toContain('200');
    }
  });

  it('draws a doughnut as even-odd ring segments, and reads a hovered slice', () => {
    const { container } = render(
      <PieChartView element={el('pie-chart', { chartVariant: 'doughnut' })} textColor="#000" />,
    );
    const paths = container.querySelectorAll('path[fill-rule="evenodd"]');
    expect(paths.length).toBe(3);
    fireEvent.pointerEnter(paths[0]!);
    expect(container.textContent).toContain('40');
  });

  it('draws a whole pie as a circle, a whole doughnut as a ring', () => {
    const one = { pieSlices: [{ label: 'All', value: 1 }] };
    expect(
      render(
        <PieChartView element={el('pie-chart', one)} textColor="#000" />,
      ).container.querySelector('circle'),
    ).not.toBeNull();
    const ring = render(
      <PieChartView
        element={el('pie-chart', { ...one, chartVariant: 'doughnut' })}
        textColor="#000"
      />,
    ).container;
    expect(ring.querySelector('circle')).toBeNull();
  });

  it('lays a Bar chart’s bars on their side from an upright baseline', () => {
    const { container } = render(
      <BarChartView element={el('bar-chart', { chartVariant: 'horizontal' })} textColor="#000" />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'));
    const rects = [...container.querySelectorAll('rect')].filter((r) => r.getAttribute('rx'));
    expect(rects.length).toBe(3);
    fireEvent.pointerEnter(rects[0]!);
    expect(container.textContent).toContain('40');
  });

  it('stands a Column chart’s bars on a level baseline', () => {
    const line = render(
      <BarChartView element={el('bar-chart')} textColor="#000" />,
    ).container.querySelector('line')!;
    expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  });

  it('fills an Area chart and draws a Scatter chart without lines', () => {
    const area = render(
      <LineChartView element={el('line-chart', { chartVariant: 'area' })} textColor="#000" />,
    ).container;
    expect(area.querySelectorAll('path[fill-opacity]').length).toBe(2);
    expect(area.querySelectorAll('polyline').length).toBe(2);
    const scatter = render(
      <LineChartView
        element={el('line-chart', {
          chartVariant: 'scatter',
          lineCategories: ['1', '5', '10'],
          lineSeries: [{ name: 'Y', values: [2, 4, 3] }],
        })}
        textColor="#000"
      />,
    ).container;
    expect(scatter.querySelectorAll('polyline').length).toBe(0);
    const dots = scatter.querySelectorAll('circle');
    expect(dots.length).toBe(3);
    // Numeric x: five ticks across the axis.
    expect([...scatter.querySelectorAll('text')].map((t) => t.textContent)).toEqual(
      expect.arrayContaining(['1', '3.25', '5.5', '7.75', '10']),
    );
    fireEvent.pointerEnter(dots[1]!);
    expect(scatter.textContent).toContain('5 · Y');
  });
});
