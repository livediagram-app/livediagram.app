import { describe, expect, it } from 'vitest';
import { applyReplace } from './replace';
import { dashboardSpecIssue } from './dashboard-body';
import type { ReplaceBody } from './types';

// A replace's `dashboard` source (docs/specs/026-plan/plan-agents.md "Making a dashboard").

describe('dashboard replace', () => {
  it('makes a new Dashboard tab', () => {
    const out = applyReplace(
      null,
      { dashboard: { metrics: ['count', 'progress'], charts: [{ view: 'calendar' }] } },
      { tabId: 't1', name: 'Overview' },
    );
    if ('errors' in out) throw new Error(JSON.stringify(out.errors));
    expect(out.tab).toMatchObject({ kind: 'dashboard', name: 'Overview' });
    expect(out.tab.elements).toHaveLength(3);
    expect(out.tab.dashboard!.rows).toHaveLength(2);
  });

  it('rebuilds a Dashboard tab in place, keeping its id, name and theme', () => {
    const made = applyReplace(
      null,
      { dashboard: {} },
      { tabId: 't1', name: 'Overview', themeId: 'ocean' },
    );
    if ('errors' in made) throw new Error('refused');
    const again = applyReplace(
      made.tab,
      { dashboard: { metrics: ['count', 'stale'] } },
      { tabId: 'x', name: 'x' },
    );
    if ('errors' in again) throw new Error(JSON.stringify(again.errors));
    expect(again.tab).toMatchObject({
      id: 't1',
      name: 'Overview',
      theme: made.tab.theme,
      kind: 'dashboard',
    });
    expect(again.tab.elements).toHaveLength(2);
    expect(again.tab.dashboard!.rows).toHaveLength(1);
  });

  it('never turns another tab into a Dashboard', () => {
    const diagram = applyReplace(null, { elements: [] }, { tabId: 't2', name: 'Flow' });
    if ('errors' in diagram) throw new Error('refused');
    const out = applyReplace(
      diagram.tab,
      { dashboard: { metrics: ['count'] } },
      { tabId: 't2', name: 'Flow' },
    );
    expect('errors' in out && out.errors[0]!.hint).toContain('add_tab');
  });

  it('names what is wrong with a body', () => {
    expect(dashboardSpecIssue([])).toContain('expected an object');
    expect(dashboardSpecIssue({ tabs: 'x' })).toContain('tabs');
    expect(dashboardSpecIssue({ tabs: [{ tabId: 't', of: 'canvas' }] })).toContain('tabs[0]');
    expect(dashboardSpecIssue({ metrics: 'x' })).toContain('metrics');
    expect(dashboardSpecIssue({ metrics: ['mood'] })).toContain('not a metric');
    expect(dashboardSpecIssue({ charts: 'x' })).toContain('charts');
    expect(dashboardSpecIssue({ charts: [{ view: 'status-mix' }] })).toContain('charts[0]');
    expect(dashboardSpecIssue({ charts: [{ view: 'gantt', settings: 1 }] })).toContain('settings');
    expect(dashboardSpecIssue({ notes: 'x' })).toContain('notes');
    expect(dashboardSpecIssue({ notes: [{ title: 1 }] })).toContain('notes[0]');
    expect(
      dashboardSpecIssue({
        tabs: [{ tabId: 't', of: 'board' }],
        notes: [{ title: 'a', text: 'b' }],
      }),
    ).toBeNull();
  });
});

// docs/specs/026-plan/plan-agents.md "Making a dashboard": a flow chart's range on a replace's dashboard body.
describe('flow charts in a dashboard body', () => {
  const flowChart = (view: string, settings?: Record<string, unknown>) =>
    dashboardSpecIssue({ charts: [{ view, ...(settings ? { settings } : {}) }] });

  it('takes the three flow charts with each range, and their card types', () => {
    for (const view of ['cycle-time', 'throughput', 'cumulative-flow']) {
      expect(flowChart(view)).toBeNull();
      for (const rangeDays of [14, 30, 90, 180]) expect(flowChart(view, { rangeDays })).toBeNull();
    }
    expect(flowChart('throughput', { types: ['bug'], rangeDays: 90 })).toBeNull();
  });

  it('refuses a range outside the four, or a range on another chart, naming what fits', () => {
    for (const rangeDays of [7, 0, 365, '30', null]) {
      const issue = flowChart('cycle-time', { rangeDays });
      expect(issue).toContain('charts[0].settings.rangeDays');
      expect(issue).toContain('14, 30, 90, 180 days');
    }
    expect(flowChart('gantt', { rangeDays: 90 })).toContain(
      'cycle-time, throughput, cumulative-flow',
    );
  });

  it('refuses settings no plan view takes', () => {
    expect(flowChart('throughput', { types: [] })).toBe(
      'dashboard.charts[0].settings: not settings a throughput chart takes',
    );
  });

  it('builds each flow chart with its range, the default never stored', () => {
    const out = applyReplace(
      null,
      {
        dashboard: {
          charts: [
            { view: 'cycle-time', settings: { rangeDays: 90 } },
            { view: 'throughput', settings: { rangeDays: 30 } },
            { view: 'cumulative-flow' },
          ],
        },
      },
      { tabId: 't1', name: 'Flow' },
    );
    if ('errors' in out) throw new Error(JSON.stringify(out.errors));
    expect(out.tab.elements.map((el) => (el as { planView?: unknown }).planView)).toEqual([
      { view: 'cycle-time', rangeDays: 90 },
      { view: 'throughput' },
      { view: 'cumulative-flow' },
    ]);
  });

  it('refuses a bad range before anything is built', () => {
    const out = applyReplace(
      null,
      { dashboard: { charts: [{ view: 'throughput', settings: { rangeDays: 7 as never } }] } },
      { tabId: 't1', name: 'Flow' },
    );
    expect('errors' in out && JSON.stringify(out.errors)).toContain('rangeDays');
  });
});

describe('dashboard replace, refused', () => {
  it('refuses a dashboard spec that is not one, naming the problem', () => {
    const out = applyReplace(null, { dashboard: 'charts please' } as unknown as ReplaceBody, {
      tabId: 't1',
      name: 'O',
    });
    expect('errors' in out && JSON.stringify(out.errors)).toMatch(/dashboard: expected an object/);
  });
});
