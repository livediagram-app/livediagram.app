// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { DataChartView } from './DataChartView';
import { PLAN_UI_FONT } from '@/lib/plan-font';

// A chart on a Sheet tab (docs/specs/009-elements/pie-chart.md "Chart types"). How each chart type draws is tested
// with the shared views, @liveworkspace/workbench/components/canvas/charts/chart-views.test.tsx.
const el = (kind: 'pie-chart' | 'bar-chart' | 'line-chart', extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), width: 260, height: 220, ...extra }) as ShapeElement;

describe('chart views', () => {
  // Axis numbers, values and the legend in the UI face, or the chart's own Font, never the tab's the element wears
  // (docs/specs/004-interface-design/fonts.md "On Sheet tabs and charts").
  it('letters every chart type in the UI face or the chart’s own Font', () => {
    for (const kind of ['pie-chart', 'bar-chart', 'line-chart'] as const) {
      const plain = render(
        <div style={{ fontFamily: 'Kalam, cursive' }}>
          <DataChartView
            element={el(kind, { chartAxis: true, chartValues: true, chartLegend: true })}
            textColor="#000"
          />
        </div>,
      ).container;
      const root = plain.firstElementChild!.firstElementChild as HTMLElement;
      expect(root.style.fontFamily).toBe(PLAN_UI_FONT);
      expect(plain.querySelector('svg')).not.toBeNull();
      // Nothing inside sets a face of its own, so every label inherits the root's.
      expect(plain.querySelector('[font-family]')).toBeNull();
      const own = render(<DataChartView element={el(kind, { font: 'lora' })} textColor="#000" />)
        .container.firstElementChild as HTMLElement;
      expect(own.style.fontFamily).toContain('Lora');
    }
  });
});
