// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Element } from '@livediagram/document';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => trackMock(...args) }));

const { useChartSetters } = await import('./useChartSetters');

// Chart type (docs/specs/009-elements/pie-chart.md "Chart types"): each selected chart takes its own patch.
function setup(selected: string[]) {
  const commits: Element[][] = [];
  const els: Element[] = [
    { ...createShape('bar-chart', 0, 0), id: 'b1', pieSlices: [{ label: 'A', value: 3 }] },
    { ...createShape('pie-chart', 0, 0), id: 'p1' },
    { ...createShape('rating', 0, 0), id: 'r1' },
  ];
  const { result } = renderHook(() =>
    useChartSetters({
      currentSelectionIds: () => new Set(selected),
      commit: (fn) => commits.push(fn(els)),
    }),
  );
  return { set: result.current.setChartTypeSelected, commits, els };
}

describe('setChartTypeSelected', () => {
  it('changes every selected chart to the type, moving its own data, leaving the rest', () => {
    trackMock.mockClear();
    const { set, commits } = setup(['b1', 'p1', 'r1']);
    set('area');
    const out = commits[0]!;
    expect(out.find((e) => e.id === 'b1')).toMatchObject({
      shape: 'line-chart',
      chartVariant: 'area',
      lineCategories: ['A'],
      lineSeries: [{ name: 'Series 1', values: [3] }],
    });
    expect(out.find((e) => e.id === 'p1')).toMatchObject({ shape: 'line-chart' });
    expect(out.find((e) => e.id === 'r1')).toMatchObject({ shape: 'rating' });
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'ChartType');
  });

  it('leaves a chart already of that type as it is', () => {
    const { set, commits, els } = setup(['b1']);
    set('column');
    expect(commits[0]![0]).toBe(els[0]);
  });

  it('does nothing with nothing selected', () => {
    trackMock.mockClear();
    const { set, commits } = setup([]);
    set('pie');
    expect(commits).toHaveLength(0);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
