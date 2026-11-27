// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ShapeElement } from '@liveworkspace/element-model/element';
import { createShape } from '@liveworkspace/element-model/testing/elements';
import { BarChartView as Bar } from './BarChartView';
import { LineChartView as Line } from './LineChartView';
import { PieChartView as Pie } from './PieChartView';
import type { ChartViewProps } from './chart-view-props';

// Each chart type on the canvas (each product's docs/specs/009-elements/pie-chart.md "Chart types", "How a chart is
// drawn"), drawn from the same marks the export draws. Moved here from the five editors' copies with the views.
const still = () => ({ className: undefined, style: undefined });
const BarChartView = (p: ChartViewProps) => <Bar {...p} anim={still} />;
const LineChartView = (p: ChartViewProps) => <Line {...p} anim={still} />;
const PieChartView = (p: ChartViewProps) => <Pie {...p} anim={still} />;

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
    // Gridlines in the chart's own text colour, faded.
    expect(line.querySelector('line[stroke="#000"][stroke-opacity="0.12"]')).not.toBeNull();
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

  it('draws a doughnut as even-odd ring segments with clear gaps, and reads a hovered slice', () => {
    const { container } = render(
      <PieChartView element={el('pie-chart', { chartVariant: 'doughnut' })} textColor="#000" />,
    );
    const paths = container.querySelectorAll('path[fill-rule="evenodd"]');
    expect(paths.length).toBe(3);
    // The gap is the ground showing through, never an outline drawn round a wedge.
    expect(container.querySelector('path[stroke]')).toBeNull();
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

  it('lays a Bar chart’s bars on their side from an upright baseline, each rounded at its value end', () => {
    const { container } = render(
      <BarChartView element={el('bar-chart', { chartVariant: 'horizontal' })} textColor="#000" />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'));
    expect(line.getAttribute('stroke-opacity')).toBe('0.35');
    const bars = [...container.querySelectorAll('svg path')];
    expect(bars.length).toBe(3);
    for (const bar of bars) expect(bar.getAttribute('d')).toContain(' A ');
    fireEvent.pointerEnter(bars[0]!);
    expect(container.textContent).toContain('40');
  });

  it('stands a Column chart’s bars on a level baseline', () => {
    const line = render(
      <BarChartView element={el('bar-chart')} textColor="#000" />,
    ).container.querySelector('line')!;
    expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  });

  it('draws a Line chart smooth, a full dot at its end, its labels growing with the chart', () => {
    const small = render(<LineChartView element={el('line-chart')} textColor="#000" />).container;
    const curve = small.querySelector('path[fill="none"]')!;
    expect(curve.getAttribute('d')).toMatch(/^M .* C /);
    const dots = [...small.querySelectorAll('svg > g:not([data-chart-hits]) circle')];
    const r = dots.map((d) => Number(d.getAttribute('r')));
    expect(r[3]!).toBeGreaterThan(r[0]!);
    const size = (c: HTMLElement) =>
      Number(c.querySelector('text[text-anchor="middle"]')!.getAttribute('font-size'));
    const big = render(
      <LineChartView element={el('line-chart', { width: 760, height: 420 })} textColor="#000" />,
    ).container;
    expect(size(big)).toBeGreaterThan(size(small));
  });

  it('fills an Area chart with a fade and draws a Scatter chart without lines', () => {
    const area = render(
      <LineChartView element={el('line-chart', { chartVariant: 'area' })} textColor="#000" />,
    ).container;
    expect(area.querySelectorAll('linearGradient').length).toBe(2);
    expect(area.querySelectorAll('path[fill^="url(#chart-fade-"]').length).toBe(2);
    expect(area.querySelectorAll('path[fill="none"]').length).toBe(2);
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
    expect(scatter.querySelectorAll('path[fill="none"]').length).toBe(0);
    const hits = scatter.querySelectorAll('[data-chart-hits] circle');
    expect(hits.length).toBe(3);
    // Numeric x: five ticks across the axis.
    expect([...scatter.querySelectorAll('text')].map((t) => t.textContent)).toEqual(
      expect.arrayContaining(['1', '3.25', '5.5', '7.75', '10']),
    );
    fireEvent.pointerEnter(hits[1]!);
    expect(scatter.textContent).toContain('5 · Y');
    fireEvent.pointerLeave(hits[1]!);
    expect(scatter.textContent).not.toContain('5 · Y');
  });

  it('prints values on every chart type when asked', () => {
    for (const View of [BarChartView, PieChartView, LineChartView]) {
      const kind =
        View === BarChartView ? 'bar-chart' : View === PieChartView ? 'pie-chart' : 'line-chart';
      const { container } = render(
        <View element={el(kind, { chartValues: true, chartLegend: false })} textColor="#000" />,
      );
      expect(container.querySelectorAll('text[font-weight="600"]').length).toBeGreaterThan(0);
    }
  });
});
