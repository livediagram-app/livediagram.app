// @vitest-environment jsdom

// The Chart tour (docs/specs/007-editor/element-tours.md "The Chart tour"): the chart read in its own words, Grow
// previewed on it, its menu, and a line chart's Chart Data dialog, opened by the tour, step by step.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { chartTourSteps, type ChartTourContext } from './chart-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

const ctxOf = (over: Partial<ChartTourContext> = {}): ChartTourContext => ({
  elementId: 'ch',
  hasMore: true,
  touch: false,
  type: 'line',
  fromSheet: false,
  ...over,
});
const api = () =>
  ({
    openChartData: vi.fn(),
    closeChartData: vi.fn(),
    previewConcept: vi.fn(),
    clearPreview: vi.fn(),
  }) as unknown as ElementTourApi;

describe('chartTourSteps', () => {
  it('reads a line chart, then walks its Chart Data dialog', () => {
    expect(chartTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'chart',
      'readout',
      'animate',
      'menu',
      'data',
      'series',
      'add-row',
      'import',
      'outro',
    ]);
  });

  it('keeps a pie, a column chart or a chart from a Sheet on the canvas, its data named in the menu step', () => {
    for (const ctx of [
      ctxOf({ type: 'pie' }),
      ctxOf({ type: 'column' }),
      ctxOf({ type: 'area', fromSheet: true }),
    ]) {
      const ids = chartTourSteps(ctx).map((s) => s.id);
      expect(ids).toEqual(['chart', 'readout', 'animate', 'menu', 'outro']);
    }
    const menu = (ctx: ChartTourContext) => chartTourSteps(ctx).find((s) => s.id === 'menu')!.body;
    expect(menu(ctxOf({ type: 'pie' }))).toContain('a row per slice');
    expect(menu(ctxOf({ type: 'area', fromSheet: true }))).toContain('Unlink From Sheet');
    expect(menu(ctxOf())).toContain('as a grid');
  });

  it('names its own type and marks', () => {
    const first = (ctx: ChartTourContext) => chartTourSteps(ctx)[0]!.body;
    expect(first(ctxOf({ type: 'doughnut' }))).toMatch(/Every slice .* a Doughnut chart/);
    expect(first(ctxOf({ type: 'bar' }))).toMatch(/Every bar .* a Bar chart/);
    expect(
      chartTourSteps(ctxOf({ type: 'scatter' })).find((s) => s.id === 'series')!.body,
    ).toContain('a new set of points');
  });

  it('leaves out the hover readout on a touch screen', () => {
    expect(chartTourSteps(ctxOf({ touch: true })).map((s) => s.id)).not.toContain('readout');
  });

  it('previews Grow on its step, and puts the dialog away on every canvas step', async () => {
    const steps = chartTourSteps(ctxOf());
    const a = api();
    await steps.find((s) => s.id === 'animate')!.prepare!(a);
    expect(a.closeChartData).toHaveBeenCalled();
    expect(a.previewConcept).toHaveBeenCalledWith('grow');
    steps.find((s) => s.id === 'animate')!.cleanup!(a);
    expect(a.clearPreview).toHaveBeenCalled();
    const b = api();
    await steps.find((s) => s.id === 'menu')!.prepare!(b);
    expect(b.closeChartData).toHaveBeenCalled();
  });

  it('opens the dialog on each dialog step, over it, and rings its control', async () => {
    const steps = chartTourSteps(ctxOf());
    for (const [id, target] of [
      ['data', 'chart-data-table'],
      ['series', 'chart-data-series'],
      ['add-row', 'chart-data-add-row'],
      ['import', 'chart-data-import'],
    ] as const) {
      const step = steps.find((s) => s.id === id)!;
      expect(step.layer).toBe('modal');
      expect(step.target).toBe(target);
      const a = api();
      await step.prepare!(a);
      expect(a.openChartData).toHaveBeenCalled();
    }
  });

  it('says Done closes the data only when the tour opened it', () => {
    expect(chartTourSteps(ctxOf()).at(-1)!.body).toContain('Done closes the data');
    expect(chartTourSteps(ctxOf({ type: 'pie' })).at(-1)!.body).not.toContain('Done');
  });
});
