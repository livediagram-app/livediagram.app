// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Element } from '@livedesign/design';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof trackMock>) => trackMock(...args),
}));

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

// Right Axis (docs/specs/009-elements/pie-chart.md "A second axis"): one series of each selected line chart on the right.
describe('setChartRightAxisSelected', () => {
  it('moves the picked series to the right, the rest off it, and None clears it', () => {
    trackMock.mockClear();
    const commits: Element[][] = [];
    const els: Element[] = [
      {
        ...createShape('line-chart', 0, 0),
        id: 'l1',
        lineSeries: [
          { name: 'A', values: [1], axis: 'right' },
          { name: 'B', values: [2] },
        ],
      },
      { ...createShape('line-chart', 0, 0), id: 'l2', lineSeries: undefined },
      { ...createShape('bar-chart', 0, 0), id: 'b1' },
    ];
    const { result } = renderHook(() =>
      useChartSetters({
        currentSelectionIds: () => new Set(['l1', 'l2', 'b1', 'gone']),
        commit: (fn) => commits.push(fn(els)),
      }),
    );
    result.current.setChartRightAxisSelected(1);
    const series = (out: Element[], id: string) =>
      (out.find((e) => e.id === id) as { lineSeries: { axis?: string }[] }).lineSeries;
    expect(series(commits[0]!, 'l1').map((s) => s.axis)).toEqual([undefined, 'right']);
    // A chart on its sample series takes them, the second on the right.
    expect(series(commits[0]!, 'l2').map((s) => s.axis)).toEqual([undefined, 'right']);
    expect(commits[0]!.find((e) => e.id === 'b1')).toBe(els[2]);
    result.current.setChartRightAxisSelected(null);
    expect(series(commits[1]!, 'l1').map((s) => s.axis)).toEqual([undefined, undefined]);
    expect(trackMock).toHaveBeenCalledWith('Element', 'Changed', 'ChartAxis');
    result.current.setChartAxisSelected(true);
    expect(commits[2]!.find((e) => e.id === 'b1')).toMatchObject({ chartAxis: true });
  });

  it('does nothing with nothing selected', () => {
    const commits: Element[][] = [];
    const { result } = renderHook(() =>
      useChartSetters({
        currentSelectionIds: () => new Set(),
        commit: (fn) => commits.push(fn([])),
      }),
    );
    result.current.setChartRightAxisSelected(0);
    expect(commits).toEqual([]);
  });
});
