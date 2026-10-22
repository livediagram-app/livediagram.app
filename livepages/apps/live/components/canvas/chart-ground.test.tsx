// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  contrastRatio,
  createShape,
  layOutPages,
  CHART_MARK_CONTRAST,
  type ShapeElement,
} from '@livepages/document';
import { useChartGround } from './CanvasSurfaceContext';
import { PageClip } from './PageClip';
import { LineChartView } from './LineChartView';
import { PieChartView } from './PieChartView';
import { exportChartInk } from '@/lib/export-chart-ink';

// docs/specs/007-editor/pages-mode.md "Charts adapt as they are drawn": the canvas finds what
// each chart on a filled page sits on and draws its series adapted to it, as the export does.
const DARK = '#0f172a';
const pages = layOutPages([
  { id: 'p', orientation: 'portrait', background: { fill: { kind: 'solid', color: DARK } } },
]);
const page = pages[0]!;
const chart = {
  ...createShape('line-chart', page.rect.x + 40, page.rect.y + 300),
  id: 'c',
  width: 300,
  height: 200,
  lineSeries: [{ name: 'Revenue', values: [1, 2, 3], color: '#334155' }],
  lineCategories: ['Jan', 'Feb', 'Mar'],
} as ShapeElement;

function Ground({ id }: { id: string }) {
  return <span data-ground={(useChartGround(id) ?? []).join(',')} />;
}

describe('chart grounds on the canvas', () => {
  it('the page clip hands each chart on a filled page its ground', () => {
    const { container } = render(
      <PageClip pages={pages} elements={[chart]}>
        <Ground id="c" />
      </PageClip>,
    );
    expect(container.querySelector('span')!.getAttribute('data-ground')).toBe(DARK);
  });

  it('outside Pages mode a chart has none', () => {
    const { container } = render(
      <PageClip pages={null} elements={[chart]}>
        <Ground id="c" />
      </PageClip>,
    );
    expect(container.querySelector('span')!.getAttribute('data-ground')).toBe('');
  });

  it('a line chart on a dark ground draws its dark series light enough to read', () => {
    const { container } = render(
      <LineChartView element={chart} textColor="#e2e8f0" ground={[DARK]} />,
    );
    const stroke = container.querySelector('polyline')!.getAttribute('stroke')!;
    expect(stroke).not.toBe('#334155');
    expect(contrastRatio(stroke, DARK)).toBeGreaterThanOrEqual(CHART_MARK_CONTRAST);
  });

  it('a pie with no ground keeps its colours', () => {
    const pie = {
      ...createShape('pie-chart', 0, 0),
      width: 200,
      height: 200,
      pieSlices: [
        { label: 'A', value: 1, color: '#334155' },
        { label: 'B', value: 1, color: '#1e293b' },
      ],
    } as ShapeElement;
    const fills = [
      ...render(<PieChartView element={pie} textColor="#000" />).container.querySelectorAll('path'),
    ].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#334155', '#1e293b']);
  });

  it('the export takes the same grounds and the theme ramp the canvas draws in', () => {
    const ink = exportChartInk({ elements: [chart], theme: undefined }, page);
    expect(ink.chartGrounds?.get('c')).toEqual([DARK]);
    expect(ink.chartPalette.length).toBeGreaterThan(0);
    expect(exportChartInk({ elements: [chart], theme: undefined }, undefined).chartGrounds).toBe(
      undefined,
    );
  });
});
