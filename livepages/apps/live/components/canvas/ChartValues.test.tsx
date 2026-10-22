// @vitest-environment jsdom

// Show Values on the canvas (docs/specs/009-elements/pie-chart.md): each chart view prints its marks' numbers when
// `chartValues` is on, from the layout the export draws, and nothing when it is off.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livepages/document';
import { BarChartView } from './BarChartView';
import { LineChartView } from './LineChartView';
import { PieChartView } from './PieChartView';

afterEach(cleanup);

const chart = (shape: ShapeElement['shape'], over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape(shape, 0, 0),
  width: 320,
  height: 240,
  ...over,
});
const texts = (c: HTMLElement) => [...c.querySelectorAll('text')].map((t) => t.textContent);

describe('Show Values on the canvas', () => {
  const months = [
    { label: 'Jul', value: 120000 },
    { label: 'Aug', value: 135000 },
  ];

  it('prints a column chart’s values and names, only when on', () => {
    const on = render(
      <BarChartView
        element={chart('bar-chart', { pieSlices: months, chartValues: true })}
        textColor="#111"
      />,
    );
    expect(texts(on.container)).toEqual(expect.arrayContaining(['120k', '135k', 'Jul', 'Aug']));
    cleanup();
    const off = render(
      <BarChartView element={chart('bar-chart', { pieSlices: months })} textColor="#111" />,
    );
    expect(texts(off.container)).not.toContain('120k');
  });

  it('prints a pie’s shares as percentages in ink that reads on each wedge', () => {
    const { container } = render(
      <PieChartView
        element={chart('pie-chart', {
          pieSlices: [
            { label: 'UK', value: 60, color: '#111827' },
            { label: 'EU', value: 40, color: '#fde68a' },
          ],
          chartValues: true,
        })}
        textColor="#111"
      />,
    );
    const values = [...container.querySelectorAll('text')].filter((t) =>
      t.textContent?.endsWith('%'),
    );
    expect(values.map((t) => t.textContent)).toEqual(['60%', '40%']);
    // A dark wedge takes light ink, a light one dark ink.
    expect(values[0]!.getAttribute('fill')).not.toBe(values[1]!.getAttribute('fill'));
  });

  it('prints a value over each point of a line chart', () => {
    const { container } = render(
      <LineChartView
        element={chart('line-chart', {
          lineCategories: ['W1', 'W2'],
          lineSeries: [{ name: 'Paid', values: [100, 130] }],
          chartValues: true,
        })}
        textColor="#111"
      />,
    );
    expect(texts(container)).toEqual(expect.arrayContaining(['100', '130']));
  });
});
